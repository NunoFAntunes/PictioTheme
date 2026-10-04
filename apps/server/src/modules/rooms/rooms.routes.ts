import {
  CreateRoomRequest,
  JoinRoomRequest,
  JoinRoomResponse,
  PublicRoomsResponse,
} from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { actorOf } from '../../plugins/actor';
import type { RoomsService } from './rooms.service';

export const roomsRoutes: FastifyPluginAsyncZod<{ rooms: RoomsService }> = async (
  app,
  { rooms },
) => {
  app.post(
    '/',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { body: CreateRoomRequest, response: { 200: JoinRoomResponse } },
    },
    async (request) => rooms.createRoom(actorOf(request), request.body),
  );

  // Rate-limited against guessing private codes (security-and-moderation.md).
  app.post(
    '/:code/join',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ code: z.string().max(20) }),
        body: JoinRoomRequest,
        response: { 200: JoinRoomResponse },
      },
    },
    async (request) => rooms.joinRoom(actorOf(request), request.params.code, request.body),
  );

  app.get('/public', { schema: { response: { 200: PublicRoomsResponse } } }, async () => ({
    rooms: rooms.listPublic(),
  }));
};
