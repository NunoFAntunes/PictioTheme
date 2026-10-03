import { defineMiddleware } from 'astro:middleware';
import { isAppRoute } from './app-routes';

/** Dev only: serve the app shell for app routes, like Caddy does in production. */
export const onRequest = defineMiddleware((context, next) => {
  if (import.meta.env.DEV && isAppRoute(context.url.pathname)) {
    return context.rewrite('/app');
  }
  return next();
});
