import { defineMiddleware } from 'astro:middleware';

/** Dev only: serve the room page for invite links (`/r/CODE`), like Caddy does in production. */
export const onRequest = defineMiddleware((context, next) => {
  if (import.meta.env.DEV && context.url.pathname.startsWith('/r/')) {
    return context.rewrite('/room');
  }
  return next();
});
