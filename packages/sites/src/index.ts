/**
 * Where every site lives (docs/technical/decisions.md D13): the games portal and each game, each on
 * its own subdomain of one parent domain, so they share the guest cookie. In development each runs
 * on its own localhost port (keep `devUrl` in sync with the app's `dev` script); cookies ignore
 * ports, so the sites share a guest there too. A build can point a site elsewhere with its `env`
 * variable. Adding a game starts here (docs/technical/architecture.md, "Adding a game").
 */
export const SITES = {
  portal: {
    devUrl: 'http://localhost:4323',
    url: 'https://games.tierney.one',
    env: 'PUBLIC_PORTAL_URL',
  },
  doodle: {
    devUrl: 'http://localhost:4321',
    url: 'https://doodle.tierney.one',
    env: 'PUBLIC_DOODLE_URL',
  },
  tower: {
    devUrl: 'http://localhost:4322',
    url: 'https://tower.tierney.one',
    env: 'PUBLIC_TOWER_URL',
  },
} as const;

export type SiteId = keyof typeof SITES;

/** A site's address for this build. Apps pass their `import.meta.env`. */
export function siteUrl(id: SiteId, env: { DEV: boolean; [key: string]: unknown }): string {
  const site = SITES[id];
  const configured = env[site.env];
  if (typeof configured === 'string' && configured !== '') return configured;
  return env.DEV ? site.devUrl : site.url;
}
