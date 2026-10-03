import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../../app';
import { testConfig } from '../../test-support/test-config';

describe('system routes', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp(testConfig());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports the process is alive', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /api/ready checks the database', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready', checks: { database: 'ok' } });
  });

  it('unknown routes use the standard error format', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});

describe('system routes without a database', () => {
  it('GET /api/ready returns 503 when the database is unreachable', async () => {
    const app = await buildApp(
      testConfig({ DATABASE_URL: 'postgres://nobody:nothing@127.0.0.1:1/none' }),
    );
    try {
      const res = await app.inject({ method: 'GET', url: '/api/ready' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' },
      });
    } finally {
      await app.close();
    }
  });
});
