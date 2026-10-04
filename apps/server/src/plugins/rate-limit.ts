import fastifyRateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

/**
 * HTTP rate limits (rule F11). Off by default; routes opt in with `config.rateLimit`.
 * In-memory store: fine for one process. Swap the store for Redis when scaling out.
 */
export const rateLimit = fp(
  async (app) => {
    await app.register(fastifyRateLimit, { global: false });
  },
  { name: 'rate-limit' },
);
