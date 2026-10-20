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

  async function enter(p: TestPlayer, name: string, code?: string): Promise<Socket> {
    await p.startSession();
    const body = { displayName: name, avatar: testAvatar([240, 120, 40]) };
    const res = code
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
    guesser.send({ t: 'guess', text: word, target: 'own' });
    const made = await host.next('piece:made');
    expect(made.piece.word).toBe(word);
    expect(made.piece.shape.parts.length).toBe(1);

    guesser.send({ t: 'piece:decide', pieceId: made.piece.id, choice: 'build' });
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
});
