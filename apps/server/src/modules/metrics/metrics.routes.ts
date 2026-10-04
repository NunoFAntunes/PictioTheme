import { ClientEvent, ClientEventResponse } from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { MetricsService } from './metrics.service';

/** Registered under `/api`. */
export const metricsRoutes: FastifyPluginAsyncZod<{ metrics: MetricsService }> = async (
  app,
  { metrics },
) => {
  // A tab sends a handful of these; the limit only stops floods.
  app.post(
    '/events',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { body: ClientEvent, response: { 200: ClientEventResponse } },
    },
    async (request) => {
      metrics.onClientEvent(request.actor ?? null, request.body);
      return { received: true as const };
    },
  );
};
