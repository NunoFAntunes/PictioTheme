import {
  DEFAULT_DECK_LANGUAGE,
  type Card,
  type DeckLanguage,
  type DeckSummary,
} from '@pictiotheme/protocol';
import { and, asc, count, eq, inArray, isNull, ne, notInArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DbExecutor } from '../../db/client';
import { cardVotes, cards, deckCovers, deckReports, decks } from '../../db/schema';

/** Decks hidden by moderation are gone for players: not playable, listed or reportable. */
const visible = ne(decks.visibility, 'hidden');
/** A cover hidden by reports shows as no cover, so players see the default one. */
const shownCoverId = sql<
  string | null
>`case when ${decks.coverHidden} then null else ${decks.coverId} end`;

export type NewDeck = {
  slug: string;
  title: string;
  description: string;
  themeQuery: string;
  tags: string[];
  source: 'ai' | 'curated' | 'remix' | 'translation';
  model: string | null;
  coverId: string | null;
  featuredRank?: number | null;
  language: DeckLanguage;
  /** For a translation: the original deck. */
  sourceDeckId?: string | null;
};

export async function insertDeck(
  db: DbExecutor,
  deck: NewDeck,
  deckCards: Card[],
): Promise<string> {
  const [row] = await db.insert(decks).values(deck).returning({ id: decks.id });
  if (!row) throw new Error('insertDeck returned no row');
  if (deckCards.length > 0) {
    await db.insert(cards).values(
      deckCards.map((c) => ({
        deckId: row.id,
        text: c.text,
        difficulty: c.difficulty,
        isSilly: c.silly,
        alternates: c.alternates,
        keywords: c.keywords,
      })),
    );
  }
  return row.id;
}

/** The deck with its cards, or null. `id` must be a uuid. */
export async function findDeckWithCards(
  db: DbExecutor,
  id: string,
): Promise<{
  id: string;
  title: string;
  coverId: string | null;
  language: DeckLanguage;
  cards: Card[];
} | null> {
  const [deck] = await db
    .select({
      id: decks.id,
      title: decks.title,
      coverId: shownCoverId,
      language: sql<DeckLanguage>`${decks.language}`,
    })
    .from(decks)
    .where(and(eq(decks.id, id), visible))
    .limit(1);
  if (!deck) return null;
  const rows = await db.select().from(cards).where(eq(cards.deckId, id)).orderBy(asc(cards.id));
  return {
    ...deck,
    cards: rows.map((c) => ({
      text: c.text,
      difficulty: c.difficulty as Card['difficulty'],
      silly: c.isSilly,
      alternates: c.alternates,
      keywords: c.keywords,
    })),
  };
}

export async function deckExists(db: DbExecutor, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, id), visible))
    .limit(1);
  return row !== undefined;
}

/** Summaries with card counts per pool, for the given deck ids (any order). */
export async function deckSummaries(db: DbExecutor, ids: string[]): Promise<DeckSummary[]> {
  if (ids.length === 0) return [];
  const count = (where: ReturnType<typeof sql>) =>
    sql<number>`count(${cards.id}) filter (where ${where})`.mapWith(Number);
  const rows = await db
    .select({
      id: decks.id,
      title: decks.title,
      description: decks.description,
      tags: decks.tags,
      coverId: shownCoverId,
      featuredRank: decks.featuredRank,
      language: decks.language,
      // The original's language and its visible translations', original first.
      languages: sql<DeckLanguage[]>`array(
        select f.language from decks f
        where f.visibility <> 'hidden'
          and (f.id = coalesce(${decks.sourceDeckId}, ${decks.id})
            or f.source_deck_id = coalesce(${decks.sourceDeckId}, ${decks.id}))
        order by f.source_deck_id nulls first, f.language)`,
      easy: count(sql`not ${cards.isSilly} and ${cards.difficulty} = 'easy'`),
      medium: count(sql`not ${cards.isSilly} and ${cards.difficulty} = 'medium'`),
      hard: count(sql`not ${cards.isSilly} and ${cards.difficulty} = 'hard'`),
      silly: count(sql`${cards.isSilly}`),
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .where(and(inArray(decks.id, ids), visible))
    .groupBy(decks.id);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    tags: r.tags,
    coverId: r.coverId,
    featured: r.featuredRank !== null,
    language: r.language as DeckLanguage,
    languages: r.languages,
    counts: { easy: r.easy, medium: r.medium, hard: r.hard, silly: r.silly },
  }));
}

/** Stores a cover. Covers are content-addressed, so storing the same drawing twice is a no-op. */
export async function insertCover(db: DbExecutor, id: string, png: Buffer): Promise<void> {
  await db.insert(deckCovers).values({ id, png }).onConflictDoNothing();
}

export async function findCoverPng(db: DbExecutor, id: string): Promise<Buffer | null> {
  const [row] = await db
    .select({ png: deckCovers.png })
    .from(deckCovers)
    .where(eq(deckCovers.id, id))
    .limit(1);
  return row?.png ?? null;
}

/** A new cover is shown again; setting the same (hidden) drawing keeps it hidden. */
export async function setDeckCover(db: DbExecutor, deckId: string, coverId: string): Promise<void> {
  await db
    .update(decks)
    .set({
      coverId,
      coverHidden: sql`${decks.coverHidden} and ${decks.coverId} is not distinct from ${coverId}`,
    })
    .where(eq(decks.id, deckId));
}

/** What a report needs to know about a visible saved deck, or null. `id` must be a uuid. */
export async function findReportableDeck(
  db: DbExecutor,
  id: string,
): Promise<{ coverId: string | null; coverHidden: boolean; source: string } | null> {
  const [row] = await db
    .select({ coverId: decks.coverId, coverHidden: decks.coverHidden, source: decks.source })
    .from(decks)
    .where(and(eq(decks.id, id), visible))
    .limit(1);
  return row ?? null;
}

export type NewReport = {
  deckId: string;
  reporterId: string;
  reason: 'cover' | 'content';
  coverId: string | null;
};

/** Records a report. Returns false when this player already reported the same thing. */
export async function insertReport(db: DbExecutor, report: NewReport): Promise<boolean> {
  const rows = await db
    .insert(deckReports)
    .values(report)
    .onConflictDoNothing()
    .returning({ id: deckReports.id });
  if (rows.length === 0) return false;
  await db
    .update(decks)
    .set({ reportCount: sql`${decks.reportCount} + 1` })
    .where(eq(decks.id, report.deckId));
  return true;
}

/** Unresolved reports of this kind (each from a different player, by the unique index). */
export async function countOpenReports(
  db: DbExecutor,
  deckId: string,
  reason: 'cover' | 'content',
  coverId: string | null,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(deckReports)
    .where(
      and(
        eq(deckReports.deckId, deckId),
        eq(deckReports.reason, reason),
        coverId === null ? isNull(deckReports.coverId) : eq(deckReports.coverId, coverId),
        isNull(deckReports.resolvedAt),
      ),
    );
  return row?.n ?? 0;
}

/** Hides the cover, unless it was redrawn since the reports were about it. */
export async function hideCover(db: DbExecutor, deckId: string, coverId: string): Promise<void> {
  await db
    .update(decks)
    .set({ coverHidden: true })
    .where(and(eq(decks.id, deckId), eq(decks.coverId, coverId)));
}

export async function hideDeck(db: DbExecutor, deckId: string): Promise<void> {
  await db.update(decks).set({ visibility: 'hidden' }).where(eq(decks.id, deckId));
}

/**
 * Inserts a curated deck, or updates the one with the same slug: same id and cover, new metadata
 * and cards. Its visibility is left alone, so a moderator's decision survives a re-seed.
 */
export async function upsertCuratedDeck(
  db: DbExecutor,
  deck: {
    slug: string;
    featuredRank: number | null;
    title: string;
    description: string;
    tags: string[];
    cards: Card[];
  },
): Promise<string> {
  const [existing] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(eq(decks.slug, deck.slug))
    .limit(1);
  if (!existing) {
    return insertDeck(
      db,
      {
        slug: deck.slug,
        title: deck.title,
        description: deck.description,
        themeQuery: deck.title,
        tags: deck.tags,
        source: 'curated',
        model: null,
        coverId: null,
        featuredRank: deck.featuredRank,
        language: DEFAULT_DECK_LANGUAGE,
      },
      deck.cards,
    );
  }
  await db
    .update(decks)
    .set({
      title: deck.title,
      description: deck.description,
      tags: deck.tags,
      featuredRank: deck.featuredRank,
      source: 'curated',
    })
    .where(eq(decks.id, existing.id));
  await syncCards(db, existing.id, deck.cards);
  return existing.id;
}

const cardKey = (text: string) => text.toLowerCase();

/**
 * Makes a deck's cards match `wanted`, matching by text (case-insensitive, like the unique
 * index): a kept card keeps its id, stats and votes, a changed one is updated, a removed one is
 * deleted (with its votes), and a new one is inserted. Unchanged cards cost no writes.
 */
async function syncCards(db: DbExecutor, deckId: string, wanted: Card[]): Promise<void> {
  const current = await db.select().from(cards).where(eq(cards.deckId, deckId));
  const byKey = new Map(current.map((c) => [cardKey(c.text), c]));
  const kept: string[] = [];
  const added: Card[] = [];
  for (const card of wanted) {
    const row = byKey.get(cardKey(card.text));
    if (!row) {
      added.push(card);
      continue;
    }
    kept.push(row.id);
    const same =
      row.text === card.text &&
      row.difficulty === card.difficulty &&
      row.isSilly === card.silly &&
      JSON.stringify(row.alternates) === JSON.stringify(card.alternates) &&
      JSON.stringify(row.keywords) === JSON.stringify(card.keywords);
    if (!same) {
      await db
        .update(cards)
        .set({
          text: card.text,
          difficulty: card.difficulty,
          isSilly: card.silly,
          alternates: card.alternates,
          keywords: card.keywords,
        })
        .where(eq(cards.id, row.id));
    }
  }
  await db
    .delete(cards)
    .where(
      kept.length > 0
        ? and(eq(cards.deckId, deckId), notInArray(cards.id, kept))
        : eq(cards.deckId, deckId),
    );
  if (added.length > 0) {
    await db.insert(cards).values(
      added.map((c) => ({
        deckId,
        text: c.text,
        difficulty: c.difficulty,
        isSilly: c.silly,
        alternates: c.alternates,
        keywords: c.keywords,
      })),
    );
  }
}

// ── Card stats and votes (docs/technical/data-model.md#metrics) ──

const sameCard = (deckId: string, text: string) =>
  and(eq(cards.deckId, deckId), sql`lower(${cards.text}) = ${cardKey(text)}`);

/**
 * A turn's cards were dealt: count the offers (only when there was a choice), the pick (only
 * when the drawer chose it) and the drawing.
 */
export async function recordCardsDealt(
  db: DbExecutor,
  deckId: string,
  dealt: { offered: string[]; drawn: string | null; pickedByDrawer: boolean },
): Promise<void> {
  const choice = dealt.offered.length > 1;
  if (choice) {
    await db
      .update(cards)
      .set({ timesOffered: sql`${cards.timesOffered} + 1` })
      .where(
        and(
          eq(cards.deckId, deckId),
          inArray(sql`lower(${cards.text})`, dealt.offered.map(cardKey)),
        ),
      );
  }
  if (dealt.drawn !== null) {
    const picked = choice && dealt.pickedByDrawer ? 1 : 0;
    await db
      .update(cards)
      .set({
        timesDrawn: sql`${cards.timesDrawn} + 1`,
        timesPicked: sql`${cards.timesPicked} + ${picked}`,
      })
      .where(sameCard(deckId, dealt.drawn));
  }
}

/** A turn on this card ended with at least one correct guess. */
export async function recordCardGuessed(
  db: DbExecutor,
  deckId: string,
  text: string,
): Promise<void> {
  await db
    .update(cards)
    .set({ timesGuessed: sql`${cards.timesGuessed} + 1` })
    .where(sameCard(deckId, text));
}

/** Sets (1 / -1) or removes (null) a player's vote on a card. Unknown cards are ignored. */
export async function setCardVote(
  db: DbExecutor,
  deckId: string,
  text: string,
  playerId: string,
  vote: 1 | -1 | null,
): Promise<void> {
  const [card] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(sameCard(deckId, text))
    .limit(1);
  if (!card) return;
  if (vote === null) {
    await db
      .delete(cardVotes)
      .where(and(eq(cardVotes.cardId, card.id), eq(cardVotes.playerId, playerId)));
    return;
  }
  await db
    .insert(cardVotes)
    .values({ cardId: card.id, playerId, vote })
    .onConflictDoUpdate({
      target: [cardVotes.cardId, cardVotes.playerId],
      set: { vote, votedAt: sql`now()` },
    });
}

export type CardQuality = {
  deckTitle: string;
  text: string;
  difficulty: string;
  silly: boolean;
  offered: number;
  picked: number;
  drawn: number;
  guessed: number;
  up: number;
  down: number;
};

/** Every card's stats and votes, for the quality report (scripts/metrics-report.ts). */
export async function cardQuality(db: DbExecutor): Promise<CardQuality[]> {
  const votes = (value: number) =>
    sql<number>`count(${cardVotes.vote}) filter (where ${cardVotes.vote} = ${value})`.mapWith(
      Number,
    );
  return db
    .select({
      deckTitle: decks.title,
      text: cards.text,
      difficulty: cards.difficulty,
      silly: cards.isSilly,
      offered: cards.timesOffered,
      picked: cards.timesPicked,
      drawn: cards.timesDrawn,
      guessed: cards.timesGuessed,
      up: votes(1),
      down: votes(-1),
    })
    .from(cards)
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .leftJoin(cardVotes, eq(cardVotes.cardId, cards.id))
    .groupBy(cards.id, decks.title);
}

/** Ids of the visible curated decks: featured first (by rank), then by title. */
export async function curatedDeckIds(db: DbExecutor): Promise<string[]> {
  const rows = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.source, 'curated'), visible))
    .orderBy(sql`${decks.featuredRank} asc nulls last`, asc(decks.title));
  return rows.map((r) => r.id);
}

/** `%` and `_` are LIKE wildcards; a search for "100%" means the text. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Ids of visible decks whose title or a tag contains `q`, or whose title is close to it
 * (trigram similarity, so "halowen" finds Halloween). Best matches first, curated before
 * generated on ties.
 */
export async function searchDeckIds(db: DbExecutor, q: string, limit: number): Promise<string[]> {
  const pattern = likePattern(q);
  const rows = await db
    .select({ id: decks.id })
    .from(decks)
    .where(
      and(
        visible,
        sql`(${decks.title} ilike ${pattern}
          or array_to_string(${decks.tags}, ' ') ilike ${pattern}
          or ${decks.title} % ${q})`,
      ),
    )
    .orderBy(
      sql`(${decks.title} ilike ${pattern}) desc`,
      sql`similarity(${decks.title}, ${q}) desc`,
      sql`(${decks.source} = 'curated') desc`,
      asc(decks.title),
    )
    .limit(limit);
  return rows.map((r) => r.id);
}

// ── Languages and translations (docs/product/decks.md#languages) ──

const original = alias(decks, 'original');
const translation = alias(decks, 'translation');

/**
 * For each deck id, the deck of the same family (its original and the original's translations)
 * written in `language`, or null if there's none. Hidden decks don't count.
 */
export async function familyMembersIn(
  db: DbExecutor,
  ids: string[],
  language: DeckLanguage,
): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: decks.id,
      originalId: original.id,
      originalLanguage: original.language,
      translationId: translation.id,
    })
    .from(decks)
    .innerJoin(original, eq(original.id, sql`coalesce(${decks.sourceDeckId}, ${decks.id})`))
    .leftJoin(
      translation,
      and(
        eq(translation.sourceDeckId, original.id),
        eq(translation.language, language),
        ne(translation.visibility, 'hidden'),
      ),
    )
    .where(inArray(decks.id, ids));
  return new Map(
    rows.map((r) => [
      r.id,
      r.originalLanguage === language ? r.originalId : (r.translationId ?? null),
    ]),
  );
}

/** The original of a deck's family (itself for an original), or null when there's no such deck. */
export async function originalIdOf(db: DbExecutor, id: string): Promise<string | null> {
  const [row] = await db
    .select({ originalId: sql<string>`coalesce(${decks.sourceDeckId}, ${decks.id})` })
    .from(decks)
    .where(eq(decks.id, id))
    .limit(1);
  return row?.originalId ?? null;
}

export type TranslationSource = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  language: DeckLanguage;
  /** The drawn cover the translation starts with (a hidden cover is not carried over). */
  coverId: string | null;
  cards: Card[];
};

/** A visible original deck with everything a translation needs. `id` must be a uuid. */
export async function findTranslationSource(
  db: DbExecutor,
  id: string,
): Promise<TranslationSource | null> {
  const [deck] = await db
    .select({
      id: decks.id,
      title: decks.title,
      description: decks.description,
      tags: decks.tags,
      language: decks.language,
      coverId: shownCoverId,
    })
    .from(decks)
    .where(and(eq(decks.id, id), isNull(decks.sourceDeckId), visible))
    .limit(1);
  if (!deck) return null;
  const withCards = await findDeckWithCards(db, id);
  return {
    ...deck,
    description: deck.description ?? '',
    language: deck.language as DeckLanguage,
    cards: withCards?.cards ?? [],
  };
}

/** Postgres unique_violation on decks_translation_unique: someone saved this translation first. */
export function isTranslationExistsViolation(err: unknown): boolean {
  const cause = err instanceof Error && 'cause' in err ? err.cause : err;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === '23505' &&
    'constraint' in cause &&
    cause.constraint === 'decks_translation_unique'
  );
}

/** The translation of `originalId` into `language`, any visibility, so a hidden one isn't made again. */
export async function findTranslationId(
  db: DbExecutor,
  originalId: string,
  language: DeckLanguage,
): Promise<string | null> {
  const [row] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.sourceDeckId, originalId), eq(decks.language, language)))
    .limit(1);
  return row?.id ?? null;
}
