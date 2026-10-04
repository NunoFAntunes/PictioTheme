import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { seedCuratedDecks } from '../modules/decks';
import { TEST_DATABASE_URL } from './test-config';

/** Runs once before the test suite: bring the test database to the latest schema and decks. */
export default async function setup() {
  try {
    await runMigrations(TEST_DATABASE_URL);
    const { db, pool } = createDb(TEST_DATABASE_URL);
    try {
      await seedCuratedDecks(db);
    } finally {
      await pool.end();
    }
  } catch (err) {
    throw new Error(
      `Could not migrate the test database at ${TEST_DATABASE_URL}. Is it running? Try \`pnpm db:up\`.`,
      { cause: err },
    );
  }
}
