import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyGuess, normalizeText, prepareCard } from '@pictiotheme/game-core';
import {
  CHAOS_MIN_CARDS,
  DECK_COVER_HEIGHT_PX,
  DECK_COVER_MAX_BYTES,
  DECK_COVER_WIDTH_PX,
  type Card,
} from '@pictiotheme/protocol';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../../db/client';
import { contentIdOf } from '../../lib/png';
import { cards as cardsTable, decks as decksTable } from '../../db/schema';
import { testCover } from '../../test-support/avatar';
import { TEST_DATABASE_URL } from '../../test-support/test-config';
import {
  CURATED_FOLDER,
  loadCuratedDecks,
  renderCuratedCover,
  seedCuratedDecks,
  type CuratedDeck,
} from './curated-decks';
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

  it('have no back cover without a deck', async () => {
    const slugs = new Set(curated.map((d) => d.slug));
    const covers = await readdir(join(CURATED_FOLDER, 'covers'));
    expect(covers.filter((f) => !slugs.has(f.replace(/\.svg$/, '')))).toEqual([]);
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
    expect(count((c) => c.kind === 'easy')).toBeGreaterThanOrEqual(20);
    expect(count((c) => c.kind === 'hard')).toBeGreaterThanOrEqual(8);
    // Chaos cards are optional: a curated deck without them gets them when a host asks.
    const chaos = count((c) => c.kind === 'chaos');
    expect(chaos === 0 || chaos >= CHAOS_MIN_CARDS).toBe(true);
  });

  it('has a back cover the size of a drawn one', async () => {
    const png = await renderCuratedCover(deck.slug);
    if (!png) throw new Error(`no covers/${deck.slug}.svg`);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
      DECK_COVER_WIDTH_PX,
      DECK_COVER_HEIGHT_PX,
    ]);
    expect(png.length).toBeLessThanOrEqual(DECK_COVER_MAX_BYTES);
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

  it('sets the cover from covers/<slug>.svg', async () => {
    const slug = `seed-cover-${Date.now()}`;
    const base = { ...(curated[0] as CuratedDeck), slug, featuredRank: null };
    const folder = await folderWith(base);
    await mkdir(join(folder, 'covers'));
    const svg = await readFile(join(CURATED_FOLDER, 'covers', `${curated[0]?.slug}.svg`), 'utf8');
    await writeFile(join(folder, 'covers', `${slug}.svg`), svg);

    await seedCuratedDecks(db, folder);
    const [seeded] = await db
      .select({ id: decksTable.id })
      .from(decksTable)
      .where(eq(decksTable.slug, slug));
    const png = await renderCuratedCover(slug, folder);
    if (!png) throw new Error('no cover');
    const coverId = contentIdOf(png);
    expect((await decks.getPlayableDeck(seeded?.id ?? '')).coverId).toBe(coverId);
    expect(await decks.getCoverPng(coverId)).toEqual(png);
  });

  it('keeps Chaos cards a host made when the file has none', async () => {
    const slug = `seed-chaos-${Date.now()}`;
    const base = { ...(curated[0] as CuratedDeck), slug, featuredRank: null };
    await seedCuratedDecks(db, await folderWith(base));
    const [seeded] = await db
      .select({ id: decksTable.id })
      .from(decksTable)
      .where(eq(decksTable.slug, slug));
    const id = seeded?.id ?? '';
    const chaos = {
      text: 'Snowman in a sauna',
      kind: 'chaos' as const,
      alternates: [],
      keywords: ['snowman', 'sauna'],
    };
    await decks.addCards(id, [chaos]);

    await seedCuratedDecks(db, await folderWith(base));
    expect((await decks.getPlayableDeck(id)).cards).toContainEqual(chaos);
  });

  it('refuses a file that is not named after its slug', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'curated-'));
    await writeFile(join(folder, 'wrong-name.json'), JSON.stringify(curated[0]));
    await expect(loadCuratedDecks(folder)).rejects.toThrow(/named after its slug/);
  });
});
