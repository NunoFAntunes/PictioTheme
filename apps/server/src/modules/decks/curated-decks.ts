import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Card } from '@pictiotheme/protocol';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { contentIdOf } from '../../lib/png';
import { renderSvg } from '../../lib/svg';
import * as repo from './decks.repository';

/**
 * Curated decks: hand-checked decks kept in the repo as JSON (one file per deck, named by slug)
 * and seeded into the `decks`/`cards` tables by `db:migrate` (docs/product/decks.md#curated-decks).
 * Editing a file and migrating again updates that deck in place: same id, same cover.
 * A deck's back cover is `covers/<slug>.svg` (300×400, no text so it suits translations too),
 * rendered to PNG when seeding. It replaces the deck's cover; without one the cover is left alone.
 */

/** Next to this file in development; copied next to the bundle in production (scripts/build.mjs). */
export const CURATED_FOLDER = fileURLToPath(new URL('./curated', import.meta.url));

/**
 * Curated decks hold far more cards than a generated one (`GeneratedDeck`), so a room rarely sees
 * the same card twice.
 */
export const CURATED_MAX_CARDS = 600;

export const CuratedDeck = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    /** Shown first in the deck picker, lowest first. Null: not featured. */
    featuredRank: z.number().int().min(1).nullable(),
    title: z.string().min(2).max(60),
    description: z.string().max(200),
    tags: z.array(z.string().min(1).max(30)).min(1).max(10),
    cards: z.array(Card).min(1).max(CURATED_MAX_CARDS),
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

/** The deck's back cover as a PNG, or null when it has no `covers/<slug>.svg`. */
export async function renderCuratedCover(
  slug: string,
  folder = CURATED_FOLDER,
): Promise<Buffer | null> {
  let svg: string;
  try {
    svg = await readFile(join(folder, 'covers', `${slug}.svg`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  return renderSvg(svg);
}

/** Inserts or updates every curated deck and its cover, in one transaction. Returns the count. */
export async function seedCuratedDecks(db: Db, folder = CURATED_FOLDER): Promise<number> {
  const decks = await loadCuratedDecks(folder);
  const covers = await Promise.all(decks.map((d) => renderCuratedCover(d.slug, folder)));
  await db.transaction(async (tx) => {
    for (const [i, deck] of decks.entries()) {
      const id = await repo.upsertCuratedDeck(tx, deck);
      const cover = covers[i];
      if (!cover) continue;
      const coverId = contentIdOf(cover);
      await repo.insertCover(tx, coverId, cover);
      await repo.setDeckCover(tx, id, coverId);
    }
  });
  return decks.length;
}
