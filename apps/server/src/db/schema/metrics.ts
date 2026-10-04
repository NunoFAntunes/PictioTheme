import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Owned by the `metrics` module (rule B5). Product events for the launch metrics, in our own
 * database instead of a third-party tool (next-features.md 1.11). No personal data: player ids
 * are random guest ids, never names or IPs. Spec: docs/technical/data-model.md#metrics.
 */
export const productEvents = pgTable(
  'product_events',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    /** `room_created`, `match_started`, `turn_ended`, `first_turn`, … (metrics.service.ts). */
    name: text().notNull(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    playerId: text(),
    roomCode: text(),
    deckId: uuid(),
    props: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('product_events_name_at_idx').on(t.name, t.at)],
);
