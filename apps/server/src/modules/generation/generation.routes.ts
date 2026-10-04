import {
  DeckGenerationRequest,
  DeckListResponse,
  DeckSummary,
  GenerationConfigResponse,
  GenerationJob,
  SetDeckCoverRequest,
} from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { actorOf } from '../../plugins/actor';
import type { GenerationJobsService } from './generation-jobs.service';

/** Registered under `/api/decks`, next to the decks routes. */
export const generationRoutes: FastifyPluginAsyncZod<{ jobs: GenerationJobsService }> = async (
  app,
  { jobs },
) => {
  app.get(
    '/generations/config',
    { schema: { response: { 200: GenerationConfigResponse } } },
    async (request) => jobs.config(request.actor ?? null),
  );

  // Each call can cost real money, so this is limited well below what a person needs.
  app.post(
    '/generations',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { body: DeckGenerationRequest, response: { 202: GenerationJob } },
    },
    async (request, reply) => {
      reply.code(202);
      return jobs.startJob(actorOf(request), request.body, request.ip);
    },
  );

  // Polled every couple of seconds while a deck is being made.
  app.get(
    '/generations/:id',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: { params: z.object({ id: z.uuid() }), response: { 200: GenerationJob } },
    },
    async (request) => jobs.getJob(actorOf(request), request.params.id),
  );

  // A drawn cover is up to ~200 KB as base64, above the app's default body limit.
  app.put(
    '/generations/:id/cover',
    {
      bodyLimit: 256 * 1024,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ id: z.uuid() }),
        body: SetDeckCoverRequest,
        response: { 200: GenerationJob },
      },
    },
    async (request) => jobs.setCover(actorOf(request), request.params.id, request.body.image),
  );

  // Redraw the cover of a deck you generated, any time after it's published.
  app.put(
    '/:id/cover',
    {
      bodyLimit: 256 * 1024,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ id: z.uuid() }),
        body: SetDeckCoverRequest,
        response: { 200: DeckSummary },
      },
    },
    async (request) => jobs.setDeckCover(actorOf(request), request.params.id, request.body.image),
  );

  app.get('/mine', { schema: { response: { 200: DeckListResponse } } }, async (request) => ({
    decks: request.actor ? await jobs.myDecks(request.actor) : [],
  }));
};
