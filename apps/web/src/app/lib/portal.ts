/**
 * The games portal, where every game is listed and the shared profile lives
 * (docs/technical/decisions.md D13). `PUBLIC_PORTAL_URL` at build time overrides it.
 */
const configured = import.meta.env.PUBLIC_PORTAL_URL as string | undefined;

export const PORTAL_URL =
  configured || (import.meta.env.DEV ? 'http://localhost:4323' : 'https://games.tierney.one');
