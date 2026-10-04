import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { bytea } from './columns';

/**
 * Owned by the `avatars` module (rule B5). Spec: docs/technical/data-model.md.
 * Drawn avatars, content-addressed: the id is derived from the PNG bytes, so re-sending the
 * same drawing reuses the row.
 */

export const avatars = pgTable('avatars', {
  id: text().primaryKey(),
  png: bytea().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  // Bumped on every use, so unused guest avatars can be cleaned up later.
  lastUsedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
