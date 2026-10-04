import { GuestSessionResponse } from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { playerIdOf } from '../../lib/actor';
import { GUEST_COOKIE } from '../../plugins/actor';
import type { AuthService } from './auth.service';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export const authRoutes: FastifyPluginAsyncZod<{
  auth: AuthService;
  secureCookies: boolean;
}> = async (app, { auth, secureCookies }) => {
  /** Idempotent: returns the existing guest, or creates one and sets the signed cookie. */
  app.post(
    '/guest',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { response: { 200: GuestSessionResponse } },
    },
    async (request, reply) => {
      if (request.actor) return { playerId: playerIdOf(request.actor) };
      const guestId = auth.newGuestId();
      reply.setCookie(GUEST_COOKIE, guestId, {
        signed: true,
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        path: '/',
        maxAge: ONE_YEAR_SECONDS,
      });
      return { playerId: playerIdOf({ kind: 'guest', guestId }) };
    },
  );
};
