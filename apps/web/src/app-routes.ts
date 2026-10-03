/**
 * Paths served by the React app shell (src/pages/app.astro).
 * Keep in sync with the rewrite in infra/Caddyfile (production) — src/middleware.ts handles dev.
 */
export const APP_ROUTE_PREFIXES = ['/play', '/r/', '/decks', '/generate', '/account'] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  );
}
