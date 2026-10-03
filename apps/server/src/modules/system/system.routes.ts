import { HealthResponse, ReadyResponse } from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { LogLevel } from '../../lib/logger';
import type { SystemService } from './system.service';

export const systemRoutes: FastifyPluginAsyncZod<{
  system: SystemService;
  /** Probes are polled constantly, so they log at a quieter level (rule F16). */
  probeLogLevel: LogLevel;
}> = async (app, { system, probeLogLevel: logLevel }) => {
  app.get('/health', { logLevel, schema: { response: { 200: HealthResponse } } }, async () => ({
    status: 'ok' as const,
  }));

  app.get('/ready', { logLevel, schema: { response: { 200: ReadyResponse } } }, async () =>
    system.checkReadiness(),
  );
};
