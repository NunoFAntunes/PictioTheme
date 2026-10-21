/**
 * The portal's name and the games it lists (docs/technical/decisions.md D13). The name is a
 * placeholder until the portal has one. Each game's address can be set at build time
 * (`PUBLIC_DOODLE_URL`, `PUBLIC_TOWER_URL`); in development they're the local dev servers.
 */
export const SITE_NAME = 'Games';
export const SITE_TAGLINE =
  'Drawing games to play with friends. One name and doodle for all of them.';

const env = import.meta.env as Record<string, string | undefined>;
const dev = import.meta.env.DEV;

export type Game = {
  name: string;
  tagline: string;
  url: string;
  icon: string;
  /** The card's colour. */
  tint: string;
  players: string;
};

export const GAMES: Game[] = [
  {
    name: 'DoodleWhirl!',
    tagline: 'Draw, guess, laugh. Themed, AI-made decks for every crowd.',
    url: env.PUBLIC_DOODLE_URL || (dev ? 'http://localhost:4321' : 'https://doodle.tierney.one'),
    icon: '/games/doodlewhirl.svg',
    tint: '#fde68a',
    players: '2–12 players',
  },
  {
    name: 'Doodle Tower',
    tagline: 'Two crews race to stack a tower out of their own drawings.',
    url: env.PUBLIC_TOWER_URL || (dev ? 'http://localhost:4322' : 'https://tower.tierney.one'),
    icon: '/games/doodle-tower.svg',
    tint: '#bae6fd',
    players: '4–12 players',
  },
];
