import type { Card } from '@pictiotheme/protocol';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { createDb } from '../../db/client';
import { cards, cardVotes, productEvents } from '../../db/schema';
import { TestPlayer } from '../../test-support/clients';
import { testConfig, TEST_DATABASE_URL } from '../../test-support/test-config';
import { createDecksService } from '../decks';

const ORIGIN = 'http://localhost:4321';

/** A deck of its own, so the card counters start at zero whatever other tests did. */
function deckCards(): Card[] {
  const make = (difficulty: Card['difficulty'], silly: boolean, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const text = `${silly ? 'Silly' : difficulty} card ${String.fromCharCode(97 + i)}`;
      return {
        text,
        difficulty,
        silly,
        alternates: [],
        keywords: [text.split(' ')[0]?.toLowerCase() ?? 'card'],
      };
    });
  return [
    ...make('easy', false, 5),
    ...make('medium', false, 5),
    ...make('hard', false, 5),
    ...make('medium', true, 3),
  ];
}

describe('metrics, end to end', () => {
  const { db, pool } = createDb(TEST_DATABASE_URL);
  let app: App;
  let baseUrl: string;
  let deckId: string;
  const player = () => new TestPlayer(baseUrl, ORIGIN);

  beforeAll(async () => {
    app = await buildApp(testConfig({ PUBLIC_ORIGIN: ORIGIN }));
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${address.port}`;
    deckId = await createDecksService({ db }).saveGeneratedDeck(
      { title: 'Metrics deck', description: '', tags: ['test'], cards: deckCards() },
      { theme: 'test', model: null, coverId: null },
    );
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  const stats = async (text: string) => {
    const [row] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.deckId, deckId), eq(cards.text, text)));
    return row;
  };

  it('records the room, the match, the cards dealt and picked, votes, and the turn result', async () => {
    const ana = player();
    const bo = player();
    const anaId = await ana.startSession();
    await bo.startSession();
    const { code, joinToken } = await ana.createRoom('Ana', false, deckId);
    const anaSocket = await ana.connect(joinToken);
    await anaSocket.next('room:snapshot');
    const boSocket = await bo.connect((await bo.joinRoom(code, 'Bo')).joinToken);
    await anaSocket.next('room:players', (m) => m.players.length === 2);

    anaSocket.send({ t: 'room:start' });
    const options = (await anaSocket.next('phase:choosing')).options ?? [];
    expect(options).toHaveLength(3);
    const [first, second, third] = options.map((o) => o.text);

    // Ana rates two options (changing her mind on one), then picks the second.
    anaSocket.send({ t: 'turn:vote', index: 0, vote: 'down' });
    anaSocket.send({ t: 'turn:vote', index: 2, vote: 'down' });
    anaSocket.send({ t: 'turn:vote', index: 2, vote: 'up' });
    anaSocket.send({ t: 'turn:choose', index: 1 });
    const word = (await anaSocket.next('phase:drawing')).word ?? '';
    expect(word).toBe(second);
    boSocket.send({ t: 'guess', text: word });
    await boSocket.next('phase:reveal');
    anaSocket.send({ t: 'room:end' });
    await anaSocket.next('phase:results');
    anaSocket.close();
    boSocket.close();
    await app.close(); // flushes pending metric writes

    expect(await stats(second ?? '')).toMatchObject({
      timesOffered: 1,
      timesPicked: 1,
      timesDrawn: 1,
      timesGuessed: 1,
    });
    expect(await stats(first ?? '')).toMatchObject({
      timesOffered: 1,
      timesPicked: 0,
      timesDrawn: 0,
    });

    const votes = await db
      .select({ text: cards.text, vote: cardVotes.vote })
      .from(cardVotes)
      .innerJoin(cards, eq(cards.id, cardVotes.cardId))
      .where(eq(cards.deckId, deckId));
    expect(votes).toEqual(
      expect.arrayContaining([
        { text: first, vote: -1 },
        { text: third, vote: 1 },
      ]),
    );
    expect(votes).toHaveLength(2);

    const events = await db.select().from(productEvents).where(eq(productEvents.roomCode, code));
    const byName = (name: string) => events.filter((e) => e.name === name);
    expect(byName('room_created')[0]).toMatchObject({ playerId: anaId, deckId });
    expect(byName('match_started')[0]?.props).toEqual({ players: 2 });
    expect(byName('turn_ended')[0]?.props).toEqual({
      reason: 'all_guessed',
      guessers: 1,
      solved: 1,
    });
    expect(byName('match_ended')[0]?.props).toMatchObject({ reason: 'host_ended', turns: 1 });
  });

  it('takes events from the browser, with or without a session', async () => {
    const server = await buildApp(testConfig({ PUBLIC_ORIGIN: ORIGIN }));
    const post = (payload: object, cookie = '') =>
      server.inject({
        method: 'POST',
        url: '/api/events',
        headers: { origin: ORIGIN, cookie },
        payload,
      });
    const session = await server.inject({
      method: 'POST',
      url: '/api/session/guest',
      headers: { origin: ORIGIN },
    });
    const cookie = session.headers['set-cookie']?.toString().split(';')[0] ?? '';
    const playerId = session.json<{ playerId: string }>().playerId;

    expect((await post({ name: 'phone_gate', action: 'shown' })).json()).toEqual({
      received: true,
    });
    expect((await post({ name: 'room_joined', device: 'tablet' }, cookie)).statusCode).toBe(200);
    expect(
      (await post({ name: 'first_turn', msSinceLanding: 12_000, viaLink: true }, cookie))
        .statusCode,
    ).toBe(200);
    expect((await post({ name: 'made_up' })).statusCode).toBe(400);
    expect((await post({ name: 'room_joined', device: 'fridge' })).statusCode).toBe(400);
    await server.close();

    const mine = await db.select().from(productEvents).where(eq(productEvents.playerId, playerId));
    expect(mine.map((e) => [e.name, e.props])).toEqual(
      expect.arrayContaining([
        ['room_joined', { device: 'tablet' }],
        ['first_turn', { msSinceLanding: 12_000, viaLink: true }],
      ]),
    );
  });
});
