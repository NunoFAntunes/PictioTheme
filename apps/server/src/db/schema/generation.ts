import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { deckCovers, decks } from './decks';

/**
 * Owned by the `generation` module (rule B5). One row per deck generation.
 * Spec: docs/technical/data-model.md#generation_jobs.
 */
export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    /** The player id (`g_<guestId>` or `u_<userId>`), so guests and accounts work the same way. */
    createdBy: text().notNull(),
    /**
     * Keyed hash of the requester's IP, for the per-IP daily limit. Never the IP itself:
     * HMAC-SHA256 with the session secret, so it can't be reversed from the database alone.
     */
    clientIpHash: text(),
    theme: text().notNull(),
    notes: text().notNull().default(''),
    difficulties: text().array().notNull(),
    includeSilly: boolean().notNull(),
    language: text().notNull().default('en'),
    status: text().notNull().default('running'),
    deckId: uuid().references(() => decks.id, { onDelete: 'set null' }),
    error: text(),
    /** The creator's drawn cover. It can arrive before the deck exists, so the job holds it too. */
    coverId: text().references(() => deckCovers.id, { onDelete: 'set null' }),
    model: text(),
    provider: text(),
    inputTokens: integer(),
    outputTokens: integer(),
    costUsd: numeric({ precision: 10, scale: 6 }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('generation_jobs_status_check', sql`${t.status} in ('running', 'published', 'failed')`),
    index('generation_jobs_created_by_idx').on(t.createdBy, t.createdAt),
    index('generation_jobs_client_ip_idx').on(t.clientIpHash, t.createdAt),
    index('generation_jobs_created_at_idx').on(t.createdAt),
    // One running generation per player, enforced even when two requests race.
    uniqueIndex('generation_jobs_one_running_idx')
      .on(t.createdBy)
      .where(sql`${t.status} = 'running'`),
  ],
);
