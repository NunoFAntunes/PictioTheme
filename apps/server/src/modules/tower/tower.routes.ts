import { JoinRoomResponse, PlayerIdentity, RoomLookupResponse } from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
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
      schema: { body: PlayerIdentity, response: { 200: JoinRoomResponse } },
    },
    async (request) => tower.createRoom(actorOf(request), request.body),
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
};
