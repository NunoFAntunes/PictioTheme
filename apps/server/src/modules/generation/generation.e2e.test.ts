import type { DeckSummary, GenerationJob } from '@pictiotheme/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { testAvatar, testCover, testPng } from '../../test-support/avatar';
import { completion, fullDeckOutput } from '../../test-support/llm';
import { testConfig } from '../../test-support/test-config';
import { contentIdOf } from '../../lib/png';
import type { LlmClient, LlmCompletion } from './llm/llm-client';

const ORIGIN = 'http://localhost:4321';
const REQUEST = { theme: 'pirates', notes: '', difficulties: ['easy', 'medium'], silly: true };

/** A model client whose replies wait until `release` is called. */
function heldLlm(reply: () => LlmCompletion) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const llm: LlmClient = {
    async completeJson() {
      await gate;
      return reply();
    },
  };
  return { llm, release };
}

const goodReply = () => completion(fullDeckOutput(['easy', 'medium'], true, 'Pirate Party'));

const apps: App[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function start(
  options: { enabled?: boolean; llm?: LlmClient | null; limits?: Record<string, string> } = {},
) {
  const app = await buildApp(
    testConfig({
      PUBLIC_ORIGIN: ORIGIN,
      DECK_GENERATION: options.enabled === false ? 'off' : 'on',
      ...(options.limits && { GENERATION_LIMITS: 'on', ...options.limits }),
    }),
    { llm: options.llm === undefined ? { completeJson: async () => goodReply() } : options.llm },
  );
  apps.push(app);
  return app;
}

async function guest(app: App): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/session/guest',
    headers: { origin: ORIGIN },
  });
  return res.headers['set-cookie']?.toString().split(';')[0] ?? '';
}

function post(app: App, cookie: string, payload: object = REQUEST, remoteAddress?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/decks/generations',
    headers: { origin: ORIGIN, cookie },
    payload,
    ...(remoteAddress && { remoteAddress }),
  });
}

/** The test database keeps jobs between runs, so each limit test uses an IP of its own. */
function freshIp(): string {
  const n = () => Math.floor(Math.random() * 250) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

const NO_BUDGET_LIMIT = { GENERATION_DAILY_BUDGET_USD: '1000000' };

async function job(app: App, cookie: string, id: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/decks/generations/${id}`,
    headers: { cookie },
  });
  return { status: res.statusCode, body: res.json<GenerationJob>() };
}

function putCover(app: App, cookie: string, id: string, image: string) {
  return app.inject({
    method: 'PUT',
    url: `/api/decks/generations/${id}/cover`,
    headers: { origin: ORIGIN, cookie },
    payload: { image },
  });
}

/** Polls like the web app does, until the job leaves `running`. */
async function settled(app: App, cookie: string, id: string): Promise<GenerationJob> {
  for (let i = 0; i < 100; i++) {
    const { body } = await job(app, cookie, id);
    if (body.status !== 'running') return body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('job never settled');
}

describe('deck generation', () => {
  it('reports whether generation is enabled, and refuses to start when it is off', async () => {
    const off = await start({ enabled: false });
    const config = await off.inject({ method: 'GET', url: '/api/decks/generations/config' });
    expect(config.json()).toEqual({ enabled: false, daily: null });

    const res = await post(off, await guest(off));
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });

    const on = await start();
    expect(
      (await on.inject({ method: 'GET', url: '/api/decks/generations/config' })).json(),
    ).toEqual({
      enabled: true,
      daily: null,
    });
  });

  it('needs a guest session and a valid request', async () => {
    const app = await start();
    expect((await post(app, '')).statusCode).toBe(401);
    const cookie = await guest(app);
    expect((await post(app, cookie, { ...REQUEST, difficulties: [] })).statusCode).toBe(400);
    expect((await post(app, cookie, { ...REQUEST, theme: 'x' })).statusCode).toBe(400);
    const blocked = await post(app, cookie, { ...REQUEST, theme: 'porn stars' });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('generates a deck in the background, then lists it and lets a room play it', async () => {
    const held = heldLlm(goodReply);
    const app = await start({ llm: held.llm });
    const cookie = await guest(app);

    const res = await post(app, cookie);
    expect(res.statusCode).toBe(202);
    const started = res.json<GenerationJob>();
    expect(started).toMatchObject({ status: 'running', theme: 'pirates', deck: null, error: null });

    held.release();
    const done = await settled(app, cookie, started.id);
    expect(done.status).toBe('published');
    expect(done.deck).toMatchObject({
      title: 'Pirate Party',
      counts: { easy: 40, medium: 40, hard: 0, silly: 40 },
    });

    const mine = await app.inject({ method: 'GET', url: '/api/decks/mine', headers: { cookie } });
    expect(mine.json<{ decks: { id: string }[] }>().decks.map((d) => d.id)).toContain(
      done.deck?.id,
    );

    const room = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: ORIGIN, cookie },
      payload: {
        name: 'Generated deck room',
        isPublic: false,
        displayName: 'Ana',
        avatar: testAvatar([1, 2, 3]),
        deckId: done.deck?.id,
      },
    });
    expect(room.statusCode).toBe(200);
  });

  it('allows one running generation per player, and hides jobs from other players', async () => {
    const held = heldLlm(goodReply);
    const app = await start({ llm: held.llm });
    const cookie = await guest(app);

    const first = (await post(app, cookie)).json<GenerationJob>();
    const second = await post(app, cookie);
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: { code: 'CONFLICT' } });

    expect((await job(app, await guest(app), first.id)).status).toBe(404);

    held.release();
    await settled(app, cookie, first.id);
    expect((await post(app, cookie)).statusCode).toBe(202);
  });

  it('records a friendly failure when the model refuses', async () => {
    const app = await start({
      llm: { completeJson: async () => completion(null, { content: null, refusal: 'No.' }) },
    });
    const cookie = await guest(app);
    const failed = await settled(app, cookie, (await post(app, cookie)).json<GenerationJob>().id);
    expect(failed).toMatchObject({ status: 'failed', deck: null });
    expect(failed.error).toMatch(/couldn't make a deck/);
  });

  it('reports itself off when no model is configured', async () => {
    const app = await start({ llm: null });
    const config = await app.inject({ method: 'GET', url: '/api/decks/generations/config' });
    expect(config.json()).toEqual({ enabled: false, daily: null });
    expect((await post(app, await guest(app))).statusCode).toBe(403);
  });

  it('fails jobs left running by a restart, and never finishes them afterwards', async () => {
    const held = heldLlm(goodReply);
    const before = await start({ llm: held.llm });
    const cookie = await guest(before);
    const id = (await post(before, cookie)).json<GenerationJob>().id;

    const after = await start(); // boots while the job is still running
    const interrupted = (await job(after, cookie, id)).body;
    expect(interrupted.status).toBe('failed');
    expect(interrupted.error).toMatch(/restarted/);

    held.release();
    await new Promise((r) => setTimeout(r, 100));
    expect((await job(after, cookie, id)).body.status).toBe('failed');
  });

  describe('daily limits', () => {
    it('lets a player generate one deck a day, and failed ones do not count', async () => {
      const refusing = await start({
        llm: { completeJson: async () => completion(null, { content: null, refusal: 'No.' }) },
        limits: { ...NO_BUDGET_LIMIT, GENERATION_PER_IP_PER_DAY: '100' },
      });
      const ip = freshIp();
      const cookie = await guest(refusing);
      const failed = (await post(refusing, cookie, REQUEST, ip)).json<GenerationJob>();
      expect((await settled(refusing, cookie, failed.id)).status).toBe('failed');

      // Same database, a working model: the failed job didn't use up the day.
      const app = await start({ limits: { ...NO_BUDGET_LIMIT, GENERATION_PER_IP_PER_DAY: '100' } });
      const config = () =>
        app.inject({ method: 'GET', url: '/api/decks/generations/config', headers: { cookie } });
      expect((await config()).json()).toEqual({
        enabled: true,
        daily: { limit: 1, remaining: 1, nextAt: null },
      });
      const first = await post(app, cookie, REQUEST, ip);
      expect(first.statusCode).toBe(202);
      await settled(app, cookie, first.json<GenerationJob>().id);

      const second = await post(app, cookie, REQUEST, ip);
      expect(second.statusCode).toBe(429);
      expect(second.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
      expect(second.json<{ error: { message: string } }>().error.message).toMatch(/about 2[34] h/);
      const after = (await config()).json<{ daily: { remaining: number; nextAt: string } }>();
      expect(after.daily.remaining).toBe(0);
      expect(Date.parse(after.daily.nextAt) - Date.now()).toBeGreaterThan(23 * 3600_000);
    });

    it('limits decks per IP, across guests', async () => {
      const app = await start({
        limits: { ...NO_BUDGET_LIMIT, GENERATION_PER_IP_PER_DAY: '2' },
      });
      const ip = freshIp();
      for (let i = 0; i < 2; i++) {
        const cookie = await guest(app);
        const res = await post(app, cookie, REQUEST, ip);
        expect(res.statusCode).toBe(202);
        await settled(app, cookie, res.json<GenerationJob>().id);
      }
      const third = await post(app, await guest(app), REQUEST, ip);
      expect(third.statusCode).toBe(429);
      // Another network is fine.
      expect((await post(app, await guest(app), REQUEST, freshIp())).statusCode).toBe(202);
      await app.close();
    });

    it('stops everyone once the daily budget is spent', async () => {
      const app = await start({ limits: { GENERATION_DAILY_BUDGET_USD: '0' } });
      const res = await post(app, await guest(app), REQUEST, freshIp());
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ error: { code: 'SERVICE_UNAVAILABLE' } });
    });
  });

  describe('back covers', () => {
    it('keeps a cover drawn while the deck generates, and serves it by id', async () => {
      const held = heldLlm(goodReply);
      const app = await start({ llm: held.llm });
      const cookie = await guest(app);
      const id = (await post(app, cookie)).json<GenerationJob>().id;

      const color: [number, number, number] = [20, 120, 220];
      const saved = await putCover(app, cookie, id, testCover(color));
      expect(saved.statusCode).toBe(200);
      expect(saved.json<GenerationJob>()).toMatchObject({ status: 'running', deck: null });

      held.release();
      const done = await settled(app, cookie, id);
      const coverId = contentIdOf(testPng(color, 300, 400));
      expect(done.deck?.coverId).toBe(coverId);

      const image = await app.inject({ method: 'GET', url: `/api/decks/covers/${coverId}` });
      expect(image.statusCode).toBe(200);
      expect(image.headers['content-type']).toBe('image/png');
      expect(image.headers['cache-control']).toContain('immutable');
      expect(image.rawPayload.equals(testPng(color, 300, 400))).toBe(true);
    });

    it('sets or replaces the cover after the deck is published', async () => {
      const app = await start();
      const cookie = await guest(app);
      const done = await settled(app, cookie, (await post(app, cookie)).json<GenerationJob>().id);
      expect(done.deck?.coverId).toBeNull();

      for (const color of [
        [1, 1, 1],
        [2, 2, 2],
      ] as [number, number, number][]) {
        const res = await putCover(app, cookie, done.id, testCover(color));
        expect(res.json<GenerationJob>().deck?.coverId).toBe(contentIdOf(testPng(color, 300, 400)));
      }
      const mine = await app.inject({ method: 'GET', url: '/api/decks/mine', headers: { cookie } });
      expect(mine.json<{ decks: { coverId: string | null }[] }>().decks[0]?.coverId).toBe(
        contentIdOf(testPng([2, 2, 2], 300, 400)),
      );
    });

    it('only takes a valid cover from the creator, for a job that has not failed', async () => {
      const held = heldLlm(goodReply);
      const app = await start({ llm: held.llm });
      const cookie = await guest(app);
      const id = (await post(app, cookie)).json<GenerationJob>().id;

      const wrongSize = await putCover(app, cookie, id, testCover([0, 0, 0], 400, 300));
      expect(wrongSize.statusCode).toBe(400);
      expect(wrongSize.json()).toMatchObject({ error: { code: 'VALIDATION' } });
      expect((await putCover(app, cookie, id, 'data:image/png;base64,AAAA')).statusCode).toBe(400);
      expect((await putCover(app, await guest(app), id, testCover())).statusCode).toBe(404);
      held.release();
      await settled(app, cookie, id);

      const refusing = await start({
        llm: { completeJson: async () => completion(null, { content: null, refusal: 'No.' }) },
      });
      const other = await guest(refusing);
      const failed = await settled(
        refusing,
        other,
        (await post(refusing, other)).json<GenerationJob>().id,
      );
      const res = await putCover(refusing, other, failed.id, testCover());
      expect(res.statusCode).toBe(409);
    });

    it("lets the creator redraw a published deck's cover, and nobody else", async () => {
      const app = await start();
      const cookie = await guest(app);
      const done = await settled(app, cookie, (await post(app, cookie)).json<GenerationJob>().id);
      const deckId = done.deck?.id ?? '';
      const redraw = (who: string, id: string, image = testCover([9, 9, 9])) =>
        app.inject({
          method: 'PUT',
          url: `/api/decks/${id}/cover`,
          headers: { origin: ORIGIN, cookie: who },
          payload: { image },
        });

      const res = await redraw(cookie, deckId);
      expect(res.statusCode).toBe(200);
      const coverId = contentIdOf(testPng([9, 9, 9], 300, 400));
      expect(res.json<DeckSummary>()).toMatchObject({ id: deckId, coverId });
      // The job follows, so a later deck-from-job lookup sees the same cover.
      expect((await job(app, cookie, done.id)).body.deck?.coverId).toBe(coverId);

      expect((await redraw(await guest(app), deckId)).statusCode).toBe(404);
      expect((await redraw('', deckId)).statusCode).toBe(401);
      expect((await redraw(cookie, '0190a000-0000-7000-8000-000000000000')).statusCode).toBe(404);
      expect((await redraw(cookie, 'builtin-halloween')).statusCode).toBe(400);
      expect((await redraw(cookie, deckId, testCover([0, 0, 0], 400, 300))).statusCode).toBe(400);
    });

    it('404s for unknown covers and rejects malformed ids', async () => {
      const app = await start();
      const get = (id: string) => app.inject({ method: 'GET', url: `/api/decks/covers/${id}` });
      expect((await get('0'.repeat(32))).statusCode).toBe(404);
      expect((await get('NOT-HEX')).statusCode).toBe(400);
    });
  });
});
