import { CloseCode } from '@pictiotheme/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { testAvatar } from '../../test-support/avatar';
import { TestPlayer } from '../../test-support/clients';
import { testConfig } from '../../test-support/test-config';

const ORIGIN = 'http://localhost:4321';

async function startServer() {
  const app = await buildApp(testConfig({ PUBLIC_ORIGIN: ORIGIN }));
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return { app, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe('realtime, end to end', () => {
  let app: App;
  let baseUrl: string;
  const player = () => new TestPlayer(baseUrl, ORIGIN);

  beforeAll(async () => {
    ({ app, baseUrl } = await startServer());
  });
  afterAll(async () => {
    await app.close();
  });

  it('two players create, join and play a turn', async () => {
    const ana = player();
    const bo = player();
    const anaId = await ana.startSession();
    const boId = await bo.startSession();

    const { code, joinToken } = await ana.createRoom('Ana', true);
    const anaSocket = await ana.connect(joinToken);
    const anaSnapshot = await anaSocket.next('room:snapshot');
    expect(anaSnapshot).toMatchObject({ you: anaId, code, phase: { kind: 'waiting' } });

    const joined = await bo.joinRoom(code.toLowerCase().replace('-', ' '), 'Bo');
    const boSocket = await bo.connect(joined.joinToken);
    await boSocket.next('room:snapshot', (m) => m.players.length === 2);
    await anaSocket.next('room:players', (m) => m.players.length === 2);

    const lobby = await ana.request('GET', '/api/rooms/public');
    expect(lobby.body).toMatchObject({ rooms: [{ code, players: 2, status: 'waiting' }] });

    anaSocket.send({ t: 'room:start' });
    const choosing = await anaSocket.next('phase:choosing');
    expect(choosing.drawerId).toBe(anaId);
    expect(choosing.options).toHaveLength(3);
    expect((await boSocket.next('phase:choosing')).options).toBeUndefined();

    anaSocket.send({ t: 'turn:choose', index: 0 });
    const drawing = await anaSocket.next('phase:drawing');
    const word = drawing.word ?? '';
    expect(word).not.toBe('');
    const boDrawing = await boSocket.next('phase:drawing');
    expect(boDrawing.word).toBeUndefined();
    expect(boDrawing.mask).toMatch(/_/);

    anaSocket.send({
      t: 'draw:begin',
      id: 's1',
      tool: 'brush',
      color: '#000000',
      size: 6,
      opacity: 1,
      x: 100,
      y: 100,
    });
    anaSocket.send({ t: 'draw:pts', id: 's1', pts: [110, 105, 0.5, 120, 110, 0.5] });
    expect((await boSocket.next('draw:pts')).pts).toEqual([110, 105, 0.5, 120, 110, 0.5]);

    boSocket.send({ t: 'guess', text: word.toUpperCase() });
    expect(await boSocket.next('guess:self')).toMatchObject({ kind: 'correct', word });
    expect(await anaSocket.next('turn:solved')).toMatchObject({ playerId: boId, order: 1 });

    // Bo was the only guesser, so the turn ends right away.
    const reveal = await boSocket.next('phase:reveal');
    expect(reveal.word).toBe(word);
    expect(reveal.deltas[boId]).toBeGreaterThan(0);
    expect(reveal.deltas[anaId]).toBeGreaterThan(0);

    anaSocket.close();
    boSocket.close();
  });

  it('a reconnecting player gets the room back from a snapshot', async () => {
    const ana = player();
    const bo = player();
    await ana.startSession();
    await bo.startSession();
    const { code, joinToken } = await ana.createRoom('Ana');
    const anaSocket = await ana.connect(joinToken);
    const boSocket = await bo.connect((await bo.joinRoom(code, 'Bo')).joinToken);
    await anaSocket.next('room:players', (m) => m.players.length === 2);

    boSocket.close();
    await anaSocket.next('room:players', (m) => m.players.some((p) => !p.connected));
    const again = await bo.connect((await bo.joinRoom(code, 'Bo')).joinToken);
    const snapshot = await again.next('room:snapshot');
    expect(snapshot.players).toHaveLength(2); // same player, not a duplicate
    anaSocket.close();
    again.close();
  });

  it('rejects an invalid join token before the upgrade', async () => {
    await expect(player().connect('not-a-token')).rejects.toThrow('upgrade rejected: 401');
  });

  it('rejects cross-origin requests', async () => {
    const mallory = player();
    await mallory.startSession();
    const res = await mallory.request(
      'POST',
      '/api/rooms',
      { name: 'Evil room', isPublic: true, displayName: 'Mal', avatar: testAvatar() },
      { origin: 'https://evil.example' },
    );
    expect(res.status).toBe(403);
  });

  it('requires a session to create a room', async () => {
    const res = await player().request('POST', '/api/rooms', {
      name: 'No session',
      isPublic: false,
      displayName: 'Nobody',
      avatar: testAvatar(),
    });
    expect(res.status).toBe(401);
  });

  it('refuses offensive player and room names', async () => {
    const p = player();
    await p.startSession();
    const create = (name: string, displayName: string) =>
      p.request('POST', '/api/rooms', { name, isPublic: true, displayName, avatar: testAvatar() });
    const badName = await create('Fun room', 'sh1thead');
    expect(badName.status).toBe(400);
    expect(badName.body).toMatchObject({ error: { code: 'VALIDATION' } });
    expect((await create('fuck this room', 'Ana')).status).toBe(400);

    const { code } = await p.createRoom('Ana');
    const guest = player();
    await guest.startSession();
    const join = await guest.request('POST', `/api/rooms/${code}/join`, {
      displayName: 'b1tch',
      avatar: testAvatar(),
    });
    expect(join.status).toBe(400);
  });

  it('explains bad room codes', async () => {
    const p = player();
    await p.startSession();
    const identity = { displayName: 'Cy', avatar: testAvatar() };
    expect((await p.request('POST', '/api/rooms/ABO-DEF/join', identity)).body).toMatchObject({
      error: { code: 'ROOM_CODE_AMBIGUOUS_LETTERS' },
    });
    expect((await p.request('POST', '/api/rooms/ZZZ-ZZZ/join', identity)).body).toMatchObject({
      error: { code: 'ROOM_NOT_FOUND' },
    });
  });

  it('closes a kicked player socket and refuses them afterwards', async () => {
    const host = player();
    const troll = player();
    await host.startSession();
    const trollId = await troll.startSession();
    const { code, joinToken } = await host.createRoom('Host');
    const hostSocket = await host.connect(joinToken);
    const trollSocket = await troll.connect((await troll.joinRoom(code, 'Troll')).joinToken);
    await hostSocket.next('room:players', (m) => m.players.length === 2);

    hostSocket.send({ t: 'room:kick', playerId: trollId });
    expect((await trollSocket.closed).code).toBe(CloseCode.kicked);
    const retry = await troll.request('POST', `/api/rooms/${code}/join`, {
      displayName: 'Troll',
      avatar: testAvatar(),
    });
    expect(retry.status).toBe(403);
    hostSocket.close();
  });

  it('answers invalid messages with an error instead of crashing', async () => {
    const p = player();
    await p.startSession();
    const socket = await p.connect((await p.createRoom('Solo')).joinToken);
    socket.socket.send('{not json');
    expect(await socket.next('error')).toMatchObject({ code: 'VALIDATION' });
    socket.send({ t: 'ping', ts: 123 });
    expect(await socket.next('pong')).toMatchObject({ ts: 123 });
    socket.close();
  });
});

describe('graceful shutdown', () => {
  it('tells players the server is restarting and closes with 1012', async () => {
    const { app, baseUrl } = await startServer();
    const p = new TestPlayer(baseUrl, ORIGIN);
    await p.startSession();
    const socket = await p.connect((await p.createRoom('Ana')).joinToken);
    await socket.next('room:snapshot');

    await app.close();
    await socket.next('server:restarting');
    expect((await socket.closed).code).toBe(CloseCode.serviceRestart);
  });
});
