import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { ROOM_COVER_HEIGHT_PX, ROOM_COVER_WIDTH_PX } from '@pictiotheme/protocol';
import { testAvatar, testCover } from '../../test-support/avatar';
import { TestPlayer, type TestSocket } from '../../test-support/clients';
import { testConfig } from '../../test-support/test-config';

const ORIGIN = 'http://localhost:4321';

describe('quick play and the lobby list, end to end', () => {
  let app: App;
  let baseUrl: string;
  const sockets: TestSocket[] = [];
  const player = async () => {
    const p = new TestPlayer(baseUrl, ORIGIN);
    await p.startSession();
    return p;
  };
  /** Joins with the token and waits until the player is in the room. */
  async function enter(p: TestPlayer, token: string) {
    const socket = await p.connect(token);
    sockets.push(socket);
    await socket.next('room:snapshot');
    return socket;
  }

  // A fresh server per test, so rooms from one test can't be picked by the next.
  beforeEach(async () => {
    app = await buildApp(testConfig({ PUBLIC_ORIGIN: ORIGIN }));
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    for (const s of sockets.splice(0)) s.close();
    await app.close();
  });

  it('creates a public room named after the player when there is none', async () => {
    const ana = await player();
    const { code, joinToken } = await ana.quickPlay('Sneaky Pickle');
    await enter(ana, joinToken);

    const lobby = await ana.request('GET', '/api/rooms/public');
    expect(lobby.body).toEqual({
      rooms: [expect.objectContaining({ code, name: "Sneaky Pickle's room", players: 1 })],
      online: 1,
    });
  });

  it('joins the fullest waiting public room, before a match in progress or a private room', async () => {
    const [ana, bo, cy, dee, eve, fay] = await Promise.all([
      player(),
      player(),
      player(),
      player(),
      player(),
      player(),
    ]);

    // A public match in progress with two players.
    const match = await ana.createRoom('Ana', true);
    const anaSocket = await enter(ana, match.joinToken);
    await enter(bo, (await bo.joinRoom(match.code, 'Bo')).joinToken);
    await anaSocket.next('room:players', (m) => m.players.length === 2);
    anaSocket.send({ t: 'room:start' });
    await anaSocket.next('phase:choosing');

    // A private room with two players, and a public one waiting with one.
    const secret = await cy.createRoom('Cy', false);
    await enter(cy, secret.joinToken);
    await enter(dee, (await dee.joinRoom(secret.code, 'Dee')).joinToken);
    const waiting = await eve.createRoom('Eve', true);
    await enter(eve, waiting.joinToken);

    const picked = await fay.quickPlay('Fay');
    expect(picked.code).toBe(waiting.code);

    const lobby = await fay.request('GET', '/api/rooms/public');
    expect((lobby.body as { online: number }).online).toBe(5);
  });

  it('joins a match in progress when no public room is waiting', async () => {
    const [ana, bo, cy] = await Promise.all([player(), player(), player()]);
    const match = await ana.createRoom('Ana', true);
    const anaSocket = await enter(ana, match.joinToken);
    await enter(bo, (await bo.joinRoom(match.code, 'Bo')).joinToken);
    await anaSocket.next('room:players', (m) => m.players.length === 2);
    anaSocket.send({ t: 'room:start' });
    await anaSocket.next('phase:choosing');

    expect((await cy.quickPlay('Cy')).code).toBe(match.code);
  });

  it('a player in the room changes name and avatar, and everyone sees it', async () => {
    const [ana, bo] = await Promise.all([player(), player()]);
    const room = await ana.createRoom('Ana');
    const anaSocket = await enter(ana, room.joinToken);
    await enter(bo, (await bo.joinRoom(room.code, 'Sneaky Pickle')).joinToken);
    await anaSocket.next('room:players', (m) => m.players.length === 2);

    const res = await bo.request('PUT', `/api/rooms/${room.code}/me`, {
      displayName: 'Bo',
      avatar: testAvatar([0, 200, 100]),
    });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    const update = await anaSocket.next('room:players', (m) =>
      m.players.some((p) => p.name === 'Bo'),
    );
    expect(update.players.map((p) => p.name).sort()).toEqual(['Ana', 'Bo']);

    // Only players in the room, and still no offensive names.
    const cy = await player();
    const outsider = await cy.request('PUT', `/api/rooms/${room.code}/me`, {
      displayName: 'Cy',
      avatar: testAvatar(),
    });
    expect(outsider.status).toBe(403);
    const rude = await bo.request('PUT', `/api/rooms/${room.code}/me`, {
      displayName: 'fuckface',
      avatar: testAvatar(),
    });
    expect(rude.status).toBe(400);
  });

  it(
    "a liked drawing becomes the room's cover, sent by its drawer",
    { timeout: 15_000 },
    async () => {
      const [ana, bo] = await Promise.all([player(), player()]);
      const room = await ana.createRoom('Ana', true);
      const anaSocket = await enter(ana, room.joinToken);
      const boSocket = await enter(bo, (await bo.joinRoom(room.code, 'Bo')).joinToken);
      await anaSocket.next('room:players', (m) => m.players.length === 2);

      anaSocket.send({ t: 'room:start' });
      await anaSocket.next('phase:choosing'); // Ana joined first, so she draws
      anaSocket.send({ t: 'turn:choose', index: 0 });
      await boSocket.next('phase:drawing');
      boSocket.send({ t: 'turn:like', liked: true });
      expect((await anaSocket.next('turn:likes')).likers).toHaveLength(1);
      anaSocket.send({ t: 'room:skipTurn' });

      // As the reveal ends, the drawer is asked for a picture.
      const request = await anaSocket.next('cover:request', () => true, 8_000);
      const image = testCover([200, 40, 40], ROOM_COVER_WIDTH_PX, ROOM_COVER_HEIGHT_PX);
      const path = `/api/rooms/${room.code}/cover`;
      expect((await bo.request('PUT', path, { turn: request.turn, image })).body).toEqual({
        accepted: false,
      });
      const wrongSize = await ana.request('PUT', path, { turn: request.turn, image: testCover() });
      expect(wrongSize.status).toBe(400);
      expect((await ana.request('PUT', path, { turn: request.turn, image })).body).toEqual({
        accepted: true,
      });

      const lobby = await ana.request('GET', '/api/rooms/public');
      expect(lobby.body).toMatchObject({ rooms: [{ code: room.code, coverVersion: 1 }] });
      const png = await fetch(`${baseUrl}${path}?v=1`);
      expect(png.status).toBe(200);
      expect(png.headers.get('content-type')).toBe('image/png');
    },
  );

  it('refuses an offensive name', async () => {
    const ana = await player();
    const res = await ana.request('POST', '/api/rooms/quick-play', {
      displayName: 'fuckface',
      avatar: testAvatar(),
    });
    expect(res).toMatchObject({ status: 400, body: { error: { code: 'VALIDATION' } } });
  });
});
