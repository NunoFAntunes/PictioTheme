import { GuestSessionResponse } from '@pictiotheme/protocol';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { playerIdOf } from '../../lib/actor';
import { GUEST_COOKIE, LEGACY_GUEST_COOKIE } from '../../plugins/actor';
import type { AuthService } from './auth.service';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export const authRoutes: FastifyPluginAsyncZod<{
  auth: AuthService;
  secureCookies: boolean;
  /** The guest cookie's Domain (the portal's and the games' parent domain), or null: host-only. */
  cookieDomain: string | null;
}> = async (app, { auth, secureCookies, cookieDomain }) => {
  const setGuestCookie = (reply: FastifyReply, guestId: string) =>
    reply.setCookie(GUEST_COOKIE, guestId, {
      signed: true,
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      ...(cookieDomain && { domain: cookieDomain }),
    });

  /**
   * Idempotent: returns the existing guest, or creates one and sets the signed cookie. A guest
   * known only by the old host-only cookie keeps their id, now in the shared cookie.
   */
  app.post(
    '/guest',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: { response: { 200: GuestSessionResponse } },
    },
    async (request, reply) => {
      if (request.actor) {
        if (request.actorFromLegacyCookie && request.actor.kind === 'guest') {
          setGuestCookie(reply, request.actor.playerKey);
          reply.clearCookie(LEGACY_GUEST_COOKIE, { path: '/' });
        }
        return { playerId: playerIdOf(request.actor) };
      }
      const guestId = auth.newGuestId();
      setGuestCookie(reply, guestId);
      return { playerId: playerIdOf({ kind: 'guest', playerKey: guestId }) };
    },
  );
};
