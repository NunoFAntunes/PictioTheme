import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { createDb } from '../../db/client';
import { testConfig, TEST_DATABASE_URL } from '../../test-support/test-config';
import { createDecksService } from './decks.service';

const ORIGIN = 'http://localhost:4321';

describe('deck reports over HTTP', () => {
  const { db, pool } = createDb(TEST_DATABASE_URL);
  const decks = createDecksService({ db });
  let app: App;
  let cookie: string;
  let deckId: string;

  beforeAll(async () => {
    app = await buildApp(testConfig({ PUBLIC_ORIGIN: ORIGIN }));
    const session = await app.inject({
      method: 'POST',
      url: '/api/session/guest',
      headers: { origin: ORIGIN },
    });
    cookie = session.headers['set-cookie']?.toString().split(';')[0] ?? '';
    deckId = await decks.saveGeneratedDeck(
      {
        title: 'Reported',
        description: '',
        tags: ['x'],
        cards: [
          { text: 'Ghost', difficulty: 'easy', silly: false, alternates: [], keywords: ['ghost'] },
        ],
      },
      { theme: 'x', model: null, coverId: null, language: 'en' },
    );
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  const report = (id: string, payload: object, who = cookie) =>
    app.inject({
      method: 'POST',
      url: `/api/decks/${id}/reports`,
      headers: { origin: ORIGIN, cookie: who },
      payload,
    });

  it('takes a report from a player with a session', async () => {
    const res = await report(deckId, { reason: 'content' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ received: true });
    // Again: still fine, and still counted once.
    expect((await report(deckId, { reason: 'content' })).statusCode).toBe(200);
  });

  it('rejects reports without a session, about built-in or unknown decks, or with no reason', async () => {
    expect((await report(deckId, { reason: 'content' }, '')).statusCode).toBe(401);
    expect((await report('builtin-halloween', { reason: 'content' })).statusCode).toBe(400);
    expect((await report(deckId, { reason: 'rude' })).statusCode).toBe(400);
    expect(
      (await report('0190a000-0000-7000-8000-000000000000', { reason: 'content' })).statusCode,
    ).toBe(404);
    expect((await report(deckId, { reason: 'cover' })).statusCode).toBe(400);
  });
});
