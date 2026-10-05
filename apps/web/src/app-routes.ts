/**
 * Paths served by the React app shell (src/pages/app.astro).
 * Keep in sync with the rewrite in infra/Caddyfile (production) — src/middleware.ts handles dev.
 */
export const APP_ROUTE_PREFIXES = ['/r/', '/decks', '/generate', '/account'] as const;

/**
 * The old lobby. The home page is the lobby now (user-flows.md §2), so it redirects to `/`.
 * (Not `/app`: that's the shell page every app route is rewritten to.)
 */
export function isOldLobbyPath(pathname: string): boolean {
  return pathname === '/play' || pathname === '/play/';
}

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  );
}
