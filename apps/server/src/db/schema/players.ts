import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { avatars } from './avatars';

/**
 * Owned by the `players` module (rule B5). Spec: docs/technical/data-model.md.
 * One row per player, shared by the portal and every game (docs/technical/decisions.md D13): the
 * name and drawing they play with everywhere. Its id is the player's key (lib/actor.ts): every
 * stored record goes by `g_<id>`. A guest's is the id in their cookie; an account will link to
 * the row (`user_id`), so a guest who signs up keeps their player and history on every device.
 */
export const players = pgTable(
  'players',
  {
    /** The player's key: the player id is `g_<id>`. A guest's is the id in their cookie. */
    id: uuid().primaryKey(),
    /** Null until a game or the portal names them. */
    displayName: text(),
    /** False while it's a made-up name (DoodleWhirl's silly name). */
    nameChosen: boolean().notNull().default(false),
    /** The avatar they drew; null: each game makes its own. */
    drawingId: text().references(() => avatars.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('players_name_chosen_check', sql`not ${t.nameChosen} or ${t.displayName} is not null`),
  ],
);
