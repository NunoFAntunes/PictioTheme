import { siteUrl } from '@pictiotheme/sites';

/**
 * The portal's name and the games it lists (docs/technical/decisions.md D13). The name is a
 * placeholder until the portal has one. Each game's address comes from `@pictiotheme/sites`.
 */

export const SITE_NAME = 'Games';
export const SITE_TAGLINE =
  'Drawing games to play with friends. One name and doodle for all of them.';

export type Game = {
  id: 'doodle' | 'tower';
  name: string;
  tagline: string;
  url: string;
  players: string;
};

/** In the order they share the screen: the first on the left (on top on a phone). */
export const GAMES: [Game, Game] = [
  {
    id: 'doodle',
    name: 'DoodleWhirl!',
    tagline: 'Draw badly. Guess wildly. A themed deck for every crowd.',
    url: siteUrl('doodle', import.meta.env),
    players: '2–12 players',
  },
  {
    id: 'tower',
    name: 'Doodle Tower',
    tagline: 'Two crews race to stack a tower out of their own drawings.',
    url: siteUrl('tower', import.meta.env),
    players: '4–12 players',
  },
];
