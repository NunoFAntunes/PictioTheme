import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Card } from '@pictiotheme/protocol';
import { z } from 'zod';
import type { Db } from '../../db/client';
import * as repo from './decks.repository';

/**
 * Curated decks: hand-checked decks kept in the repo as JSON (one file per deck, named by slug)
 * and seeded into the `decks`/`cards` tables by `db:migrate` (docs/product/decks.md#curated-decks).
 * Editing a file and migrating again updates that deck in place: same id, same cover.
 */

/** Next to this file in development; copied next to the bundle in production (scripts/build.mjs). */
export const CURATED_FOLDER = fileURLToPath(new URL('./curated', import.meta.url));

export const CuratedDeck = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    /** Shown first in the deck picker, lowest first. Null: not featured. */
    featuredRank: z.number().int().min(1).nullable(),
    title: z.string().min(2).max(60),
    description: z.string().max(200),
    tags: z.array(z.string().min(1).max(30)).min(1).max(10),
    cards: z.array(Card).min(1).max(250),
  })
  .strict();
export type CuratedDeck = z.infer<typeof CuratedDeck>;

export async function loadCuratedDecks(folder = CURATED_FOLDER): Promise<CuratedDeck[]> {
  const files = (await readdir(folder)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (file) => {
      const parsed = CuratedDeck.safeParse(JSON.parse(await readFile(join(folder, file), 'utf8')));
      if (!parsed.success)
        throw new Error(`Invalid curated deck ${file}: ${z.prettifyError(parsed.error)}`);
      if (`${parsed.data.slug}.json` !== file) {
        throw new Error(`Curated deck ${file} must be named after its slug (${parsed.data.slug})`);
      }
      return parsed.data;
    }),
  );
}

/** Inserts or updates every curated deck, in one transaction. Returns how many were seeded. */
export async function seedCuratedDecks(db: Db, folder = CURATED_FOLDER): Promise<number> {
  const decks = await loadCuratedDecks(folder);
  await db.transaction(async (tx) => {
    for (const deck of decks) await repo.upsertCuratedDeck(tx, deck);
  });
  return decks.length;
}
