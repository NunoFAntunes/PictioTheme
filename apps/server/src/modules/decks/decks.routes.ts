import {
  DeckCoverId,
  DeckLanguage,
  DeckListQuery,
  DeckListResponse,
  DeckSummary,
  ReportDeckRequest,
  ReportDeckResponse,
  SavedDeckId,
} from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { playerIdOf } from '../../lib/actor';
import { notFound } from '../../lib/errors';
import { actorOf } from '../../plugins/actor';
import { IMMUTABLE_PNG_HEADERS } from '../../lib/png';
import type { DecksService } from './decks.service';

export const decksRoutes: FastifyPluginAsyncZod<{ decks: DecksService }> = async (
  app,
  { decks },
) => {
  app.get(
    '/',
    { schema: { querystring: DeckListQuery, response: { 200: DeckListResponse } } },
    async (request) => ({
      decks: await decks.listDecks(request.query.q, request.query.language),
    }),
  );

  // The deck in another language, if it's been translated into it (404 otherwise). Asked when
  // the host changes the room's language, to switch to the translation without making one.
  app.get(
    '/:id/translations/:language',
    {
      schema: {
        params: z.object({ id: SavedDeckId, language: DeckLanguage }),
        response: { 200: DeckSummary },
      },
    },
    async (request) => {
      const deck = await decks.findInLanguage(request.params.id, request.params.language);
      if (!deck) throw notFound('Translation');
      return deck;
    },
  );

  // Ids are content hashes, so a response never changes and can be cached forever.
  app.get(
    '/covers/:id',
    { schema: { params: z.object({ id: DeckCoverId }) } },
    async (request, reply) => {
      const png = await decks.getCoverPng(request.params.id);
      if (!png) throw notFound('Deck cover');
      return reply.headers(IMMUTABLE_PNG_HEADERS).send(png);
    },
  );

  // TODO(moderation): many throwaway guest sessions could hide a deck; per-IP limits help, the
  // moderator queue (next-features.md 2.9) reviews what got hidden.
  app.post(
    '/:id/reports',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ id: SavedDeckId }),
        body: ReportDeckRequest,
        response: { 200: ReportDeckResponse },
      },
    },
    async (request) => {
      await decks.report(playerIdOf(actorOf(request)), request.params.id, request.body.reason);
      return { received: true as const };
    },
  );
};
