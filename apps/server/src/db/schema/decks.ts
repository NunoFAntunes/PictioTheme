import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Owned by the `decks` module (rule B5). Spec: docs/technical/data-model.md.
 * Column names are snake_case in SQL (Drizzle `casing: 'snake_case'`).
 * Search columns (tsvector, trigram index) are added with the deck search feature.
 */

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
    timesDrawn: integer().notNull().default(0),
    timesGuessed: integer().notNull().default(0),
    flags: integer().notNull().default(0),
  },
  (t) => [
    check('cards_difficulty_check', sql`${t.difficulty} in ('easy', 'medium', 'hard')`),
    uniqueIndex('cards_deck_text_unique').on(t.deckId, sql`lower(${t.text})`),
  ],
);
