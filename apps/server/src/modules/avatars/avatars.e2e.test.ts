import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { testAvatar, testPng } from '../../test-support/avatar';
import { testConfig } from '../../test-support/test-config';
import { avatarIdOf } from './avatars.service';

const ORIGIN = 'http://localhost:4321';

describe('avatars', () => {
  let app: App;
  let cookie: string;

  beforeAll(async () => {
    app = await buildApp(testConfig({ PUBLIC_ORIGIN: ORIGIN }));
    const session = await app.inject({
      method: 'POST',
      url: '/api/session/guest',
      headers: { origin: ORIGIN },
    });
    cookie = session.headers['set-cookie']?.toString().split(';')[0] ?? '';
  });
  afterAll(async () => {
    await app.close();
  });

  const createRoom = (avatar: string) =>
    app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { origin: ORIGIN, cookie },
      payload: { name: 'Avatar room', isPublic: false, displayName: 'Ana', avatar },
    });

  it('stores the avatar sent on create and serves it by id', async () => {
    const color: [number, number, number] = [12, 200, 34];
    expect((await createRoom(testAvatar(color))).statusCode).toBe(200);

    const res = await app.inject({
      method: 'GET',
      url: `/api/avatars/${avatarIdOf(testPng(color))}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.rawPayload.equals(testPng(color))).toBe(true);
  });

  it('rejects images that are not PNGs of the avatar size', async () => {
    const wrongSize = await createRoom(testAvatar([1, 2, 3], 64));
    expect(wrongSize.statusCode).toBe(400);
    expect(wrongSize.json()).toMatchObject({ error: { code: 'VALIDATION' } });

    const notPng = await createRoom(
      `data:image/png;base64,${Buffer.from('<svg/>').toString('base64')}`,
    );
    expect(notPng.statusCode).toBe(400);
  });

  it('404s for unknown ids and rejects malformed ones', async () => {
    expect(
      (await app.inject({ method: 'GET', url: `/api/avatars/${'0'.repeat(32)}` })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/avatars/../etc' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/avatars/NOT-HEX' })).statusCode).toBe(400);
  });
});
