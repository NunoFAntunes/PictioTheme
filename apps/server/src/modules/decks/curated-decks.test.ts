import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyGuess, normalizeText, prepareCard } from '@pictiotheme/game-core';
import type { Card } from '@pictiotheme/protocol';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../../db/client';
import { cards as cardsTable, decks as decksTable } from '../../db/schema';
import { testCover } from '../../test-support/avatar';
import { TEST_DATABASE_URL } from '../../test-support/test-config';
import { loadCuratedDecks, seedCuratedDecks, type CuratedDeck } from './curated-decks';
import { createDecksService } from './decks.service';

const curated = await loadCuratedDecks();

describe('the curated deck files', () => {
  it('exist, with a featured deck to start rooms with', () => {
    expect(curated.length).toBeGreaterThanOrEqual(2);
    expect(curated.some((d) => d.featuredRank !== null)).toBe(true);
  });

  it('have unique featured ranks', () => {
    const ranks = curated.flatMap((d) => (d.featuredRank === null ? [] : [d.featuredRank]));
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});

describe.each(curated.map((d) => [d.slug, d] as const))('%s', (_slug, deck) => {
  it('has no duplicate cards', () => {
    const normalized = deck.cards.map((c) => normalizeText(c.text));
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it('accepts each card text and alternate as a correct guess', () => {
    for (const card of deck.cards) {
      const prepared = prepareCard(card);
      for (const answer of [card.text, ...card.alternates]) {
        expect(classifyGuess(prepared, answer), `${card.text} ← ${answer}`).toBe('correct');
      }
    }
  });

  it('has enough cards of each kind for a full game', () => {
    const count = (pred: (c: Card) => boolean) => deck.cards.filter(pred).length;
    expect(count((c) => !c.silly && c.difficulty === 'easy')).toBeGreaterThanOrEqual(10);
    expect(count((c) => !c.silly && c.difficulty === 'medium')).toBeGreaterThanOrEqual(10);
    expect(count((c) => !c.silly && c.difficulty === 'hard')).toBeGreaterThanOrEqual(8);
    expect(count((c) => c.silly)).toBeGreaterThanOrEqual(8);
  });
});

describe('seeding', () => {
  const { db, pool } = createDb(TEST_DATABASE_URL);
  const decks = createDecksService({ db });
  afterAll(async () => {
    await pool.end();
  });

  async function folderWith(deck: CuratedDeck): Promise<string> {
    const folder = await mkdtemp(join(tmpdir(), 'curated-'));
    await writeFile(join(folder, `${deck.slug}.json`), JSON.stringify(deck));
    return folder;
  }

  it('updates a deck in place, keeping its id and cover', async () => {
    const slug = `seed-test-${Date.now()}`;
    const base = { ...(curated[0] as CuratedDeck), slug, featuredRank: null };
    await seedCuratedDecks(db, await folderWith(base));
    const [seeded] = await db
      .select({ id: decksTable.id, source: decksTable.source })
      .from(decksTable)
      .where(eq(decksTable.slug, slug));
    expect(seeded?.source).toBe('curated');
    const id = seeded?.id ?? '';
    const coverId = await decks.storeCover(testCover([1, 2, 3]));
    await decks.setCover(id, coverId);

    const kept = base.cards[0];
    if (!kept) throw new Error('no cards');
    const cardId = async () =>
      (
        await db
          .select({ id: cardsTable.id, drawn: cardsTable.timesDrawn })
          .from(cardsTable)
          .where(and(eq(cardsTable.deckId, id), eq(cardsTable.text, kept.text)))
      )[0];
    await decks.recordCardsDealt(id, {
      offered: [kept.text],
      drawn: kept.text,
      pickedByDrawer: true,
    });
    const before = await cardId();

    // Edit the deck: new title, fewer cards, and the kept card's alternates changed.
    const edited = {
      ...base,
      title: 'Edited deck',
      cards: [{ ...kept, alternates: ['a new alternate'] }, ...base.cards.slice(1, 5)],
    };
    await seedCuratedDecks(db, await folderWith(edited));
    const playable = await decks.getPlayableDeck(id);
    expect(playable.title).toBe('Edited deck');
    expect(playable.cards).toHaveLength(5);
    expect(playable.cards.find((c) => c.text === kept.text)?.alternates).toEqual([
      'a new alternate',
    ]);
    expect(playable.coverId).toBe(coverId);
    // The kept card is the same row, stats included.
    expect(await cardId()).toEqual(before);
    expect(before?.drawn).toBe(1);
  });

  it('refuses a file that is not named after its slug', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'curated-'));
    await writeFile(join(folder, 'wrong-name.json'), JSON.stringify(curated[0]));
    await expect(loadCuratedDecks(folder)).rejects.toThrow(/named after its slug/);
  });
});
