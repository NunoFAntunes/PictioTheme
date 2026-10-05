import { defineMiddleware } from 'astro:middleware';
import { isAppRoute, isOldLobbyPath } from './app-routes';

/** Dev only: serve the app shell for app routes and redirect the old lobby, like Caddy does. */
export const onRequest = defineMiddleware((context, next) => {
  if (import.meta.env.DEV && isOldLobbyPath(context.url.pathname)) {
    return context.redirect('/', 301);
  }
  if (import.meta.env.DEV && isAppRoute(context.url.pathname)) {
    return context.rewrite('/app');
  }
  return next();
});
