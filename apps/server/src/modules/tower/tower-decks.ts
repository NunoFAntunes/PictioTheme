import type { Db } from '../../db/client';
import { addTowerDecks } from './tower.repository';

/**
 * The initial tower allowlist (docs/tower/product/word-pool.md#initial-allowlist): curated decks
 * whose easy cards are concrete things that draw well as one object. Seeded by `db:migrate` after
 * the curated decks; a deck added or switched off by hand later stays that way.
 */
export const TOWER_DECK_SLUGS = [
  'everyday-objects',
  'food-and-drink',
  'animals',
  'places-and-geography',
  'nostalgia-trip',
  'halloween',
] as const;

export async function seedTowerDecks(db: Db): Promise<number> {
  return addTowerDecks(db, TOWER_DECK_SLUGS);
}
