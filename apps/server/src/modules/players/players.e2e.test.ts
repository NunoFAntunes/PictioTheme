import type { Profile } from '@pictiotheme/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { testAvatar } from '../../test-support/avatar';
import { testConfig } from '../../test-support/test-config';

const ORIGIN = 'http://localhost:4321';
const PORTAL = 'http://localhost:4323';

describe('the shared profile (/api/me)', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp(testConfig({ PUBLIC_ORIGIN: ORIGIN, COOKIE_DOMAIN: 'example.test' }));
  });
  afterAll(async () => {
    await app.close();
  });

  async function guest(origin = ORIGIN) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/session/guest',
      headers: { origin },
    });
    const setCookie = res.headers['set-cookie']?.toString() ?? '';
    return { setCookie, cookie: setCookie.split(';')[0] ?? '' };
  }

  const me = (cookie: string) => app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
  const save = (cookie: string, payload: object, origin = ORIGIN) =>
    app.inject({ method: 'PUT', url: '/api/me', headers: { origin, cookie }, payload });

  it('needs a guest session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
  });

  it('sets the guest cookie for the parent domain, so every game shares it', async () => {
    const { setCookie } = await guest();
    expect(setCookie).toMatch(/^play_guest=/);
    expect(setCookie).toContain('Domain=example.test');
  });

  it('starts empty, then keeps the name and drawing', async () => {
    const { cookie } = await guest();
    const empty = (await me(cookie)).json<Profile>();
    expect(empty).toMatchObject({
      kind: 'guest',
      displayName: null,
      nameChosen: false,
      drawing: null,
    });
    expect(empty.playerId).toMatch(/^g_/);

    const drawing = testAvatar([200, 40, 90]);
    const saved = await save(cookie, { displayName: 'Ana', drawing });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ displayName: 'Ana', nameChosen: true, drawing });
    expect((await me(cookie)).json()).toMatchObject({ displayName: 'Ana', drawing });

    // Dropping the drawing leaves the name alone.
    const dropped = (await save(cookie, { drawing: null })).json<Profile>();
    expect(dropped).toMatchObject({ displayName: 'Ana', drawing: null });
  });

  it('never lets a made-up name replace a chosen one', async () => {
    const { cookie } = await guest();
    const auto = (
      await save(cookie, { displayName: 'Wobbly Penguin', nameChosen: false })
    ).json<Profile>();
    expect(auto).toMatchObject({ displayName: 'Wobbly Penguin', nameChosen: false });

    await save(cookie, { displayName: 'Ana' });
    const after = (
      await save(cookie, { displayName: 'Sneaky Otter', nameChosen: false })
    ).json<Profile>();
    expect(after).toMatchObject({ displayName: 'Ana', nameChosen: true });
  });

  it('rejects empty changes, bad names and bad drawings', async () => {
    const { cookie } = await guest();
    expect((await save(cookie, {})).statusCode).toBe(400);
    expect((await save(cookie, { nameChosen: true })).statusCode).toBe(400);
    expect((await save(cookie, { displayName: 'x' })).statusCode).toBe(400);
    expect((await save(cookie, { drawing: testAvatar([1, 2, 3], 64) })).statusCode).toBe(400);
  });

  it("accepts the portal's origin and blocks others", async () => {
    const { cookie } = await guest(PORTAL);
    expect((await save(cookie, { displayName: 'Ana' }, PORTAL)).statusCode).toBe(200);
    expect((await save(cookie, { displayName: 'Ana' }, 'https://evil.test')).statusCode).toBe(403);
  });

  it('keeps a returning guest from the old host-only cookie, moving them to the shared one', async () => {
    const { cookie } = await guest();
    await save(cookie, { displayName: 'Old Timer' });
    // The same signed value, in the old cookie.
    const signed = cookie.slice('play_guest='.length);
    const legacy = `pt_guest=${signed}`;
    const guestId = decodeURIComponent(signed).split('.')[0] ?? '';

    expect((await me(legacy)).json()).toMatchObject({ displayName: 'Old Timer' });
    const moved = await app.inject({
      method: 'POST',
      url: '/api/session/guest',
      headers: { origin: ORIGIN, cookie: legacy },
    });
    const cookies = [moved.headers['set-cookie'] ?? []].flat().join('\n');
    expect(cookies).toContain(`play_guest=${guestId}.`);
    expect(cookies).toMatch(/pt_guest=;/);
  });
});
