import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Config } from './config';
import { createDb } from './db/client';
import { atLeast } from './lib/logger';
import { authRoutes, createAuthService } from './modules/auth';
import { avatarsRoutes, createAvatarsService } from './modules/avatars';
import { createDecksService, decksRoutes } from './modules/decks';
import { createMetricsService, metricsRoutes } from './modules/metrics';
import {
  createGenerationJobsService,
  createGenerationService,
  createOpenRouterClient,
  generationRoutes,
  type LlmClient,
} from './modules/generation';
import { createConnectionRegistry, realtimeGateway } from './modules/realtime';
import { createRoomsService, roomsRoutes } from './modules/rooms';
import { createSystemService, systemRoutes } from './modules/system';
import { actorPlugin } from './plugins/actor';
import { errorHandler } from './plugins/error-handler';
import { originCheck } from './plugins/origin-check';
import { rateLimit } from './plugins/rate-limit';

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

/** The deck model, or the cheaper theme-check model (ai-deck-pipeline.md#theme-check). */
function createLlm(config: Config, use: 'deck' | 'themeCheck'): LlmClient | null {
  const { apiKey, requireParameters } = config.openRouter;
  if (!apiKey) return null;
  const deck = use === 'deck';
  return createOpenRouterClient({
    apiKey,
    model: deck ? config.openRouter.deckModel : config.openRouter.themeCheckModel,
    fallbackModels: deck
      ? config.openRouter.fallbackModels
      : config.openRouter.themeCheckFallbackModels,
    requireParameters,
    appUrl: config.publicOrigin,
  });
}

/**
 * `overrides.llm` replaces both OpenRouter clients (deck and theme check) in tests: CI never calls
 * OpenRouter.
 */
export async function buildApp(config: Config, overrides: { llm?: LlmClient | null } = {}) {
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

  const connections = createConnectionRegistry();

  // ── Services (in dependency order) ──
  const system = createSystemService({ db, log: app.log });
  const auth = createAuthService({ secret: config.sessionSecret });
  const decks = createDecksService({ db });
  const llm = overrides.llm !== undefined ? overrides.llm : createLlm(config, 'deck');
  const themeCheckLlm =
    overrides.llm !== undefined ? overrides.llm : createLlm(config, 'themeCheck');
  const generation = createGenerationService({ llm, themeCheckLlm, log: app.log });
  const generationJobs = createGenerationJobsService({
    db,
    log: app.log,
    generation,
    decks,
    // Without an API key there's nothing to generate with, so the feature reports itself off.
    enabled: config.deckGeneration && llm !== null,
    limits: config.generationLimits,
    secret: config.sessionSecret,
  });
  await generationJobs.failInterrupted();
  const avatars = createAvatarsService({ db });
  const metrics = createMetricsService({ db, log: app.log, decks });
  const rooms = createRoomsService({
    decks,
    auth,
    avatars,
    metrics,
    transport: connections,
    log: app.log,
    publicOrigin: config.publicOrigin,
  });

  // Tell players and close rooms before the server stops accepting connections.
  app.addHook('preClose', async () => rooms.shutdown());
  // Let short jobs finish. Longer ones are failed by `failInterrupted` on the next boot.
  app.addHook('preClose', async () => generationJobs.idle(5_000));
  // After the rooms closed (their last matches ended), let pending metric writes land.
  app.addHook('preClose', async () => metrics.idle());

  // ── Plugins ──
  await app.register(errorHandler);
  await app.register(originCheck, { publicOrigin: config.publicOrigin });
  if (config.rateLimits) await app.register(rateLimit);
  await app.register(actorPlugin, { cookieSecret: config.sessionSecret });

  // ── Routes ──
  await app.register(systemRoutes, {
    prefix: '/api',
    system,
    probeLogLevel: atLeast(config.logLevel, 'warn'),
  });
  await app.register(authRoutes, {
    prefix: '/api/session',
    auth,
    secureCookies: config.secureCookies,
  });
  await app.register(avatarsRoutes, { prefix: '/api/avatars', avatars });
  await app.register(decksRoutes, { prefix: '/api/decks', decks });
  await app.register(generationRoutes, { prefix: '/api/decks', jobs: generationJobs });
  await app.register(roomsRoutes, { prefix: '/api/rooms', rooms });
  await app.register(metricsRoutes, { prefix: '/api', metrics });
  await app.register(realtimeGateway, { rooms, auth, connections });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
