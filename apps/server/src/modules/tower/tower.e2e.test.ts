import type { JoinRoomResponse } from '@pictiotheme/protocol';
import type { TowerClientMessage, TowerServerMessage } from '@pictiotheme/protocol/tower';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { createDb } from '../../db/client';
import { testAvatar } from '../../test-support/avatar';
import { TestPlayer, type TestSocket } from '../../test-support/clients';
import { TEST_DATABASE_URL, testConfig } from '../../test-support/test-config';
import { towerMixWords } from './tower.repository';

const TOWER_ORIGIN = 'http://localhost:4322';

type Socket = TestSocket<TowerServerMessage, TowerClientMessage>;

/** A rectangle outline, as a mouse would draw it: a solid brick. */
function brick(id: string): TowerClientMessage[] {
  const corners = [
    [300, 300],
    [900, 300],
    [900, 600],
    [300, 600],
    [300, 306],
  ];
  const pts: number[] = [];
  for (let i = 1; i < corners.length; i++) {
    const [ax = 0, ay = 0] = corners[i - 1] ?? [];
    const [bx = 0, by = 0] = corners[i] ?? [];
    for (let k = 1; k <= 20; k++) {
      pts.push(Math.round(ax + ((bx - ax) * k) / 20), Math.round(ay + ((by - ay) * k) / 20), 0.5);
    }
  }
  return [
    { t: 'draw:begin', id, tool: 'brush', color: '#000000', size: 10, opacity: 1, x: 300, y: 300 },
    { t: 'draw:pts', id, pts },
    { t: 'draw:end', id },
  ];
}

describe('Doodle Tower, end to end', () => {
  let app: App;
  let baseUrl: string;
  const player = () => new TestPlayer(baseUrl, TOWER_ORIGIN);

  /** Creates a room, joins `code`, or (`'quick-play'`) lets Quick game choose. */
  async function enter(p: TestPlayer, name: string, code?: string): Promise<Socket> {
    await p.startSession();
    const body = { displayName: name, avatar: testAvatar([240, 120, 40]) };
    const res =
      code === 'quick-play'
        ? await p.request('POST', '/api/tower/rooms/quick-play', body)
        : code
          ? await p.request('POST', `/api/tower/rooms/${code}/join`, body)
          : await p.request('POST', '/api/tower/rooms', body);
    expect(res.status).toBe(200);
    const { joinToken } = res.body as JoinRoomResponse;
    return p.connect<TowerServerMessage, TowerClientMessage>(joinToken, '/ws/tower');
  }

  beforeAll(async () => {
    app = await buildApp(
      testConfig({ TOWER_PUBLIC_ORIGIN: TOWER_ORIGIN, TOWER_PHYSICS_WORKERS: '1' }),
    );
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await app.close();
  });

  it("deals the allowlisted decks' easy cards", async () => {
    const { db, pool } = createDb(TEST_DATABASE_URL);
    try {
      const words = await towerMixWords(db);
      expect(words.length).toBeGreaterThan(500);
      expect(words.every((w) => w.kind === 'easy')).toBe(true);
      expect(new Set(words.map((w) => w.text.toLowerCase())).size).toBe(words.length);
      expect(words.map((w) => w.text)).toEqual(expect.arrayContaining(['Bucket', 'Banana', 'Dog']));
    } finally {
      await pool.end();
    }
  });

  it("refuses a DoodleWhirl join token on the tower's socket", async () => {
    const p = player();
    await p.startSession();
    const { joinToken } = await p.createRoom('Ana');
    await expect(p.connect(joinToken, '/ws/tower')).rejects.toThrow(/upgrade rejected: 401/);
  });

  it('Quick game skips private lobbies, makes a public room, then fills it', async () => {
    const lobby = await enter(player(), 'Pri');
    const { code: privateCode, settings } = await lobby.next('room:snapshot');
    expect(settings.isPublic).toBe(false);

    const first = await enter(player(), 'Quin', 'quick-play');
    const made = await first.next('room:snapshot');
    expect(made.code).not.toBe(privateCode);
    expect(made.settings.isPublic).toBe(true);
    expect(made.hostId).toBe(made.you);

    const second = await enter(player(), 'Quill', 'quick-play');
    expect((await second.next('room:snapshot')).code).toBe(made.code);

    // The host makes the lobby public: now Quick game can find it too.
    lobby.send({ t: 'settings:update', settings: { isPublic: true } });
    await lobby.next('room:settings', (m) => m.settings.isPublic);
    const third = await enter(player(), 'Quip', 'quick-play');
    // The fuller waiting room wins.
    expect((await third.next('room:snapshot')).code).toBe(made.code);
    for (const s of [lobby, first, second, third]) s.close();
  });

  it('a player renames themselves in the room, and only players in it can', async () => {
    const host = player();
    const socket = await enter(host, 'Hana');
    const { code } = await socket.next('room:snapshot');
    const body = { displayName: 'Hanabi', avatar: testAvatar([10, 20, 30]) };

    expect((await host.request('PUT', `/api/tower/rooms/${code}/me`, body)).status).toBe(200);
    const update = await socket.next('room:players', (m) =>
      m.players.some((p) => p.name === 'Hanabi'),
    );
    expect(update.players).toHaveLength(1);

    const stranger = player();
    await stranger.startSession();
    expect((await stranger.request('PUT', `/api/tower/rooms/${code}/me`, body)).status).toBe(403);
    socket.close();
  });

  it("serves the room's share card and the page link previews unfurl", async () => {
    const host = await enter(player(), 'Ana');
    const { code } = await host.next('room:snapshot');

    const embed = await fetch(`${baseUrl}/api/tower/rooms/${code}/embed`);
    expect(embed.status).toBe(200);
    expect(embed.headers.get('content-type')).toContain('text/html');
    const html = await embed.text();
    expect(html).toContain('Ana&#39;s tower');
    expect(html).toContain(`${TOWER_ORIGIN}/r/${code}`);
    const image = /og:image" content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(image).toMatch(new RegExp(`/api/tower/rooms/${code}/card\\.png\\?v=\\w+$`));

    const card = await fetch(`${baseUrl}${new URL(image).pathname}${new URL(image).search}`);
    expect(card.status).toBe(200);
    expect(card.headers.get('content-type')).toBe('image/png');
    expect(card.headers.get('cache-control')).toContain('immutable');
    const latest = await fetch(`${baseUrl}/api/tower/rooms/${code}/card.png`);
    expect(latest.headers.get('cache-control')).toBe('no-cache');

    // A rule on the card changes: so does its version.
    host.send({ t: 'settings:update', settings: { line: 'tall' } });
    await host.next('room:settings', (m) => m.settings.line === 'tall');
    const after = await (await fetch(`${baseUrl}/api/tower/rooms/${code}/embed`)).text();
    expect(/og:image" content="([^"]+)"/.exec(after)?.[1]).not.toBe(image);

    expect((await fetch(`${baseUrl}/api/tower/rooms/ZZZ-ZZZ/embed`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/tower/rooms/ZZZ-ZZZ/card.png`)).status).toBe(404);
    host.close();
  });

  it('four players play a round: draw, guess, build, place, and the tower grows', async () => {
    const host = await enter(player(), 'Ana');
    const { code } = await host.next('room:snapshot');
    const others = [
      await enter(player(), 'Bo', code),
      await enter(player(), 'Cy', code),
      await enter(player(), 'Di', code),
    ];
    const sockets = [host, ...others];
    await host.next('room:players', (m) => m.players.length === 4);

    host.send({ t: 'match:start' });
    const snapshots = await Promise.all(
      sockets.map((s) => s.next('room:snapshot', (m) => m.phase === 'playing', 5_000)),
    );
    // Find orange's drawer (the only one who sees the word) and an orange guesser.
    const drawerIndex = snapshots.findIndex((s) => s.crews.orange.round?.word);
    const drawer = sockets[drawerIndex];
    const word = snapshots[drawerIndex]?.crews.orange.round?.word ?? '';
    const orange = snapshots.map((s) => s.players.find((p) => p.id === s.you)?.team);
    const guesserIndex = orange.findIndex((t, i) => t === 'orange' && i !== drawerIndex);
    const guesser = sockets[guesserIndex];
    if (!drawer || !guesser) throw new Error('no orange drawer or guesser');
    expect(word).not.toBe('');
    expect(snapshots[guesserIndex]?.crews.orange.round?.word).toBeUndefined();

    for (const op of brick('b1')) drawer.send(op);
    // Everyone else watches the strokes arrive.
    await guesser.next('crew:draw', (m) => m.team === 'orange' && m.op.t === 'draw:end');
    guesser.send({ t: 'guess', text: word });
    const made = await host.next('piece:made');
    expect(made.piece.word).toBe(word);
    expect(made.piece.shape.parts.length).toBe(1);

    // The drawer chooses (and places it, being free now).
    drawer.send({ t: 'piece:decide', pieceId: made.piece.id, choice: 'keep' });
    const start = await host.next('place:start', (m) => m.tower === 'orange');
    expect(start.placing.pieceId).toBe(made.piece.id);
    // The physics worker spawned it: frames come in with it.
    const frame = await host.next(
      'tower:frame',
      (m) => m.tower === 'orange' && m.bodies[0] === made.piece.id,
      5_000,
    );
    expect(frame.bodies).toHaveLength(4);

    const placer = sockets[snapshots.findIndex((s) => s.you === start.placing.placerId)];
    placer?.send({ t: 'place:steer', x: 0.5 });
    placer?.send({ t: 'place:drop' });
    await host.next('place:end', (m) => m.pieceId === made.piece.id, 5_000);
    const height = await host.next(
      'tower:height',
      (m) => m.tower === 'orange' && m.height > 0.5,
      5_000,
    );
    // A 1 m² brick drawn 2:1 is about 0.7 m tall.
    expect(height.height).toBeLessThan(1.2);

    // Someone reconnecting gets the tower as it stands.
    const late = await enter(player(), 'Ed', code);
    await late.next('room:snapshot', (m) => m.pieces.length === 1);
    const poses = await late.next(
      'tower:frame',
      (m) => m.tower === 'orange' && m.bodies.length > 0,
    );
    expect(poses.bodies[0]).toBe(made.piece.id);

    for (const s of [...sockets, late]) s.close();
  });

  it('test mode: one player, bots, a "guess correctly" button, and the rival bot places', async () => {
    const p = player();
    await p.startSession();
    const body = { displayName: 'Tess', avatar: testAvatar([40, 120, 240]), testMode: true };
    const res = await p.request('POST', '/api/tower/rooms', body);
    expect(res.status).toBe(200);
    const me = await p.connect<TowerServerMessage, TowerClientMessage>(
      (res.body as JoinRoomResponse).joinToken,
      '/ws/tower',
    );
    const waiting = await me.next('room:snapshot');
    expect(waiting.settings).toMatchObject({ testMode: true, isPublic: false });

    me.send({ t: 'match:start' });
    const playing = await me.next('room:snapshot', (m) => m.phase === 'playing', 5_000);
    // The drawer bots have each drawn a rectangle.
    expect(playing.crews.orange.round?.strokes.map((s) => s.tool)).toEqual(['brush', 'fill']);

    me.send({ t: 'test', action: { kind: 'solve', target: 'own' } });
    const made = await me.next('piece:made');
    expect(made.deciding.deciderId).toBe(playing.you);
    me.send({ t: 'piece:decide', pieceId: made.piece.id, choice: 'curse' });
    const start = await me.next('place:start', (m) => m.tower === 'teal');
    expect(start.placing.placerId).toBe('bot-teal-builder');
    // The bot lets it down on its own: their tower grows.
    await me.next('place:end', (m) => m.pieceId === made.piece.id, 10_000);
    await me.next('tower:height', (m) => m.tower === 'teal' && m.height > 0.3, 5_000);
    me.close();
  });
});
