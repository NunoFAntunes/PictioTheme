import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea } from './columns';

/**
 * Owned by the `decks` module (rule B5). Spec: docs/technical/data-model.md.
 * Column names are snake_case in SQL (Drizzle `casing: 'snake_case'`).
 * Search columns (tsvector, trigram index) are added with the deck search feature.
 */

/**
 * Drawn deck back covers, content-addressed like avatars: the id is derived from the PNG bytes.
 * Spec: docs/technical/data-model.md.
 */
export const deckCovers = pgTable('deck_covers', {
  id: text().primaryKey(),
  png: bytea().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const decks = pgTable(
  'decks',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    slug: text().notNull().unique(),
    title: text().notNull(),
    description: text(),
    themeQuery: text().notNull(),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    language: text().notNull().default('en'),
    familyFriendly: boolean().notNull().default(true),
    visibility: text().notNull().default('public'),
    // References users(id) once the users module exists.
    createdBy: uuid(),
    source: text().notNull(),
    model: text(),
    /** Null shows the default cover, made from the title. */
    coverId: text().references(() => deckCovers.id, { onDelete: 'set null' }),
    /** Hidden by reports: the deck shows the default cover until a new one is drawn. */
    coverHidden: boolean().notNull().default(false),
    /** Curated decks shown first, lowest first (the featured row). Null: not featured. */
    featuredRank: smallint(),
    playCount: integer().notNull().default(0),
    upvotes: integer().notNull().default(0),
    downvotes: integer().notNull().default(0),
    reportCount: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('decks_visibility_check', sql`${t.visibility} in ('public', 'unlisted', 'hidden')`),
    check('decks_source_check', sql`${t.source} in ('ai', 'curated', 'remix')`),
    index('decks_tags_idx').using('gin', t.tags),
  ],
);

export const cards = pgTable(
  'cards',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    deckId: uuid()
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    text: text().notNull(),
    difficulty: text().notNull(),
    isSilly: boolean().notNull().default(false),
    alternates: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    keywords: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Shown as one of a drawer's options (only when there was a choice). */
    timesOffered: integer().notNull().default(0),
    /** Chosen by the drawer from the options (not picked at random when time ran out). */
    timesPicked: integer().notNull().default(0),
    timesDrawn: integer().notNull().default(0),
    /** Turns where at least one guesser got it. */
    timesGuessed: integer().notNull().default(0),
    flags: integer().notNull().default(0),
  },
  (t) => [
    check('cards_difficulty_check', sql`${t.difficulty} in ('easy', 'medium', 'hard')`),
    uniqueIndex('cards_deck_text_unique').on(t.deckId, sql`lower(${t.text})`),
  ],
);

/**
 * Players' reports of a deck's cover or content (docs/technical/security-and-moderation.md).
 * One report per player, reason and cover: enough unique reports hide the cover or the deck.
 */
export const deckReports = pgTable(
  'deck_reports',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    deckId: uuid()
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    /** The player id (`g_<guestId>` or `u_<userId>`). */
    reporterId: text().notNull(),
    reason: text().notNull(),
    /** The cover a `cover` report is about, kept for review even after it's redrawn. */
    coverId: text().references(() => deckCovers.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('deck_reports_reason_check', sql`${t.reason} in ('cover', 'content')`),
    uniqueIndex('deck_reports_once_idx').on(
      t.deckId,
      t.reporterId,
      t.reason,
      sql`coalesce(${t.coverId}, '')`,
    ),
  ],
);

/**
 * Drawers' 👍/👎 on the cards they were offered (docs/technical/data-model.md#metrics). One vote
 * per player per card; voting again replaces it, taking it back deletes it.
 */
export const cardVotes = pgTable(
  'card_votes',
  {
    cardId: uuid()
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    /** The player id (`g_<guestId>` or `u_<userId>`). */
    playerId: text().notNull(),
    /** 1 for 👍, -1 for 👎. */
    vote: smallint().notNull(),
    votedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.cardId, t.playerId] }),
    check('card_votes_vote_check', sql`${t.vote} in (1, -1)`),
  ],
);
