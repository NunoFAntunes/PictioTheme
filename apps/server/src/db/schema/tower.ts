import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { decks } from './decks';

/**
 * Owned by the `tower` module (rule B5): Doodle Tower's own tables, next to DoodleWhirl's.
 * Spec: docs/tower/technical/data-model.md.
 */

/** The decks whose easy cards Doodle Tower deals (docs/tower/product/word-pool.md). */
export const towerDecks = pgTable('tower_decks', {
  deckId: uuid()
    .primaryKey()
    .references(() => decks.id, { onDelete: 'cascade' }),
  enabled: boolean().notNull().default(true),
  /** Later: show guessers a category ("🎬 a movie"). */
  showCategory: boolean().notNull().default(false),
  categoryLabel: text(),
  sort: smallint().notNull().default(0),
});

export const towerMatches = pgTable(
  'tower_matches',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    roomCode: text().notNull(),
    settings: jsonb().$type<Record<string, unknown>>().notNull(),
    /** Null: a draw, or abandoned. */
    winner: text(),
    endReason: text().notNull(),
    heightOrange: real().notNull(),
    heightTeal: real().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    endedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    check('tower_matches_winner_check', sql`${t.winner} in ('orange', 'teal')`),
    check(
      'tower_matches_end_reason_check',
      sql`${t.endReason} in ('topped_out', 'time', 'abandoned')`,
    ),
    index('tower_matches_ended_at_idx').on(t.endedAt),
  ],
);

export const towerMatchPlayers = pgTable(
  'tower_match_players',
  {
    matchId: uuid()
      .notNull()
      .references(() => towerMatches.id, { onDelete: 'cascade' }),
    /** 'g_<players.id>' (lib/actor.ts) */
    playerId: text().notNull(),
    team: text().notNull(),
    displayName: text().notNull(),
    drawings: integer().notNull(),
    solves: integer().notNull(),
    steals: integer().notNull(),
    sends: integer().notNull(),
    placements: integer().notNull(),
    fumbles: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerId] }),
    check('tower_match_players_team_check', sql`${t.team} in ('orange', 'teal')`),
  ],
);
