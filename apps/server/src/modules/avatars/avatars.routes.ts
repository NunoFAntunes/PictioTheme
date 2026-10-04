import { AvatarId } from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { IMMUTABLE_PNG_HEADERS } from '../../lib/png';
import type { AvatarsService } from './avatars.service';

export const avatarsRoutes: FastifyPluginAsyncZod<{ avatars: AvatarsService }> = async (
  app,
  { avatars },
) => {
  // Ids are content hashes, so a response never changes and can be cached forever.
  app.get('/:id', { schema: { params: z.object({ id: AvatarId }) } }, async (request, reply) => {
    const png = await avatars.getPng(request.params.id);
    if (!png) throw notFound('Avatar');
    return reply.headers(IMMUTABLE_PNG_HEADERS).send(png);
  });
};
