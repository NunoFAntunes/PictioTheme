import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { errorHandler } from './error-handler';

async function appWithRoutes() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorHandler);

  app.post(
    '/echo',
    { schema: { body: z.object({ name: z.string().min(2) }) } },
    async (req) => req.body,
  );
  app.get('/app-error', async () => {
    throw new AppError('ROOM_FULL', 409, 'This room is full');
  });
  app.get('/crash', async () => {
    throw new Error('database password is hunter2');
  });
  return app;
}

describe('error handler', () => {
  it('maps AppError to its status and code', async () => {
    const app = await appWithRoutes();
    const res = await app.inject({ method: 'GET', url: '/app-error' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'ROOM_FULL', message: 'This room is full' } });
  });

  it('maps schema validation failures to 400 VALIDATION', async () => {
    const app = await appWithRoutes();
    const res = await app.inject({ method: 'POST', url: '/echo', payload: { name: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('maps malformed JSON to 400 VALIDATION', async () => {
    const app = await appWithRoutes();
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"name":',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });

  it('hides the details of unexpected errors', async () => {
    const app = await appWithRoutes();
    const res = await app.inject({ method: 'GET', url: '/crash' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });
});
