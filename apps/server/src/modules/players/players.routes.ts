import { Profile, UpdateProfileRequest } from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { actorOf } from '../../plugins/actor';
import type { PlayersService } from './players.service';

/** `/api/me`: the profile every game and the portal share. */
export const playersRoutes: FastifyPluginAsyncZod<{ players: PlayersService }> = async (
  app,
  { players },
) => {
  app.get('/', { schema: { response: { 200: Profile } } }, async (request) =>
    players.profile(actorOf(request)),
  );

  app.put(
    '/',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { body: UpdateProfileRequest, response: { 200: Profile } },
    },
    async (request) => players.update(actorOf(request), request.body),
  );
};
