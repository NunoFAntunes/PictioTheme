import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Config } from './config';
import { createDb } from './db/client';
import { atLeast } from './lib/logger';
import { createSystemService, systemRoutes } from './modules/system';
import { errorHandler } from './plugins/error-handler';

/**
 * Composition root (rule B11): the only place that creates infrastructure and services
 * and wires them together. Tests call it with a test config and use `app.inject()`.
 */

function loggerOptions(config: Config): FastifyServerOptions['logger'] {
  return {
    level: config.logLevel,
    redact: ['req.headers.cookie', 'req.headers.authorization', '*.token', '*.joinToken'],
    ...(config.env === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  };
}

export async function buildApp(config: Config) {
  const app = Fastify({
    logger: loggerOptions(config),
    trustProxy: config.trustProxy.length > 0 ? config.trustProxy : false,
    bodyLimit: 64 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ── Infrastructure ──
  const { db, pool } = createDb(config.databaseUrl);
  app.addHook('onClose', async () => {
    await pool.end();
  });

  // ── Services (in dependency order) ──
  const system = createSystemService({ db, log: app.log });

  // ── Plugins and routes ──
  await app.register(errorHandler);
  await app.register(systemRoutes, {
    prefix: '/api',
    system,
    probeLogLevel: atLeast(config.logLevel, 'warn'),
  });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
