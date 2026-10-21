import fastifyCookie from '@fastify/cookie';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Actor } from '../lib/actor';
import { unauthenticated } from '../lib/errors';

/** Resolves the guest cookie into `request.actor` (rule F6). */

/**
 * One guest for the portal and every game: set for the parent domain (`COOKIE_DOMAIN`), so all
 * the subdomains get it (docs/technical/decisions.md D13).
 */
export const GUEST_COOKIE = 'play_guest';
/**
 * The cookie before D13, host-only on DoodleWhirl's site. Still read, so a returning guest keeps
 * their id; `POST /api/session/guest` moves it to GUEST_COOKIE.
 */
export const LEGACY_GUEST_COOKIE = 'pt_guest';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor | null;
    /** True when the actor came from LEGACY_GUEST_COOKIE only. */
    actorFromLegacyCookie: boolean;
  }
}

export const actorPlugin = fp<{ cookieSecret: string }>(
  async (app, { cookieSecret }) => {
    await app.register(fastifyCookie, { secret: cookieSecret });
    app.decorateRequest('actor', null);
    app.decorateRequest('actorFromLegacyCookie', false);
    app.addHook('onRequest', async (request) => {
      const guestId = (name: string) => {
        const raw = request.cookies[name];
        if (!raw) return null;
        const { valid, value } = request.unsignCookie(raw);
        return valid && value ? value : null;
      };
      const current = guestId(GUEST_COOKIE);
      const legacy = current ? null : guestId(LEGACY_GUEST_COOKIE);
      const id = current ?? legacy;
      // A guest's player key is the id in their cookie (lib/actor.ts).
      if (id) request.actor = { kind: 'guest', playerKey: id };
      request.actorFromLegacyCookie = legacy !== null;
    });
  },
  { name: 'actor' },
);

/** For handlers behind auth: the actor, or a 401. */
export function actorOf(request: FastifyRequest): Actor {
  if (!request.actor) throw unauthenticated();
  return request.actor;
}
