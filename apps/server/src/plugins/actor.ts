import fastifyCookie from '@fastify/cookie';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Actor } from '../lib/actor';
import { unauthenticated } from '../lib/errors';

/** Resolves the guest cookie into `request.actor` (rule F6). */

export const GUEST_COOKIE = 'pt_guest';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

export const actorPlugin = fp<{ cookieSecret: string }>(
  async (app, { cookieSecret }) => {
    await app.register(fastifyCookie, { secret: cookieSecret });
    app.decorateRequest('actor', null);
    app.addHook('onRequest', async (request) => {
      const raw = request.cookies[GUEST_COOKIE];
      if (!raw) return;
      const { valid, value } = request.unsignCookie(raw);
      if (valid && value) request.actor = { kind: 'guest', guestId: value };
    });
  },
  { name: 'actor' },
);

/** For handlers behind auth: the actor, or a 401. */
export function actorOf(request: FastifyRequest): Actor {
  if (!request.actor) throw unauthenticated();
  return request.actor;
}
