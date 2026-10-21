import { JoinRoomResponse, PlayerIdentity, RoomLookupResponse } from '@pictiotheme/protocol';
import { CreateTowerRoomRequest } from '@pictiotheme/protocol/tower';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IMMUTABLE_PNG_HEADERS } from '../../lib/png';
import { actorOf } from '../../plugins/actor';
import type { TowerService } from './tower.service';

/** Doodle Tower's rooms, under `/api/tower`. Rate limits as DoodleWhirl's rooms. */
export const towerRoutes: FastifyPluginAsyncZod<{ tower: TowerService }> = async (
  app,
  { tower },
) => {
  app.post(
    '/rooms',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { body: CreateTowerRoomRequest, response: { 200: JoinRoomResponse } },
    },
    async (request) => tower.createRoom(actorOf(request), request.body),
  );

  // Quick game. It may create a room, so it's limited like create, with room for a few retries.
  app.post(
    '/rooms/quick-play',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { body: PlayerIdentity, response: { 200: JoinRoomResponse } },
    },
    async (request) => tower.quickPlay(actorOf(request), request.body),
  );

  // Rate-limited against guessing private codes (security-and-moderation.md).
  app.get(
    '/rooms/:code',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ code: z.string().max(20) }),
        response: { 200: RoomLookupResponse },
      },
    },
    async (request) => tower.lookup(request.params.code),
  );

  app.post(
    '/rooms/:code/join',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ code: z.string().max(20) }),
        body: PlayerIdentity,
        response: { 200: JoinRoomResponse },
      },
    },
    async (request) => tower.joinRoom(actorOf(request), request.params.code, request.body),
  );

  // The share card (tower-share-card.ts): link previews ask for `?v=<version>` from the embed
  // page, which is cached forever; the waiting room's preview asks without it and gets the current one.
  // Rate-limited like the lookup: it tells whether a code is live.
  app.get(
    '/rooms/:code/card.png',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ code: z.string().max(20) }),
        querystring: z.object({ v: z.string().max(40).optional() }),
      },
    },
    async (request, reply) => {
      const card = await tower.shareCard(request.params.code);
      const current = request.query.v === card.version;
      return reply
        .headers({ ...IMMUTABLE_PNG_HEADERS, ...(current ? {} : { 'cache-control': 'no-cache' }) })
        .send(card.png);
    },
  );

  // What link preview bots (Discord, Slack, WhatsApp…) get for /r/CODE: Caddy sends them here.
  app.get(
    '/rooms/:code/embed',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { params: z.object({ code: z.string().max(20) }) },
    },
    async (request, reply) =>
      reply
        .type('text/html; charset=utf-8')
        .header('cache-control', 'no-cache')
        .send(tower.shareEmbed(request.params.code)),
  );
};
