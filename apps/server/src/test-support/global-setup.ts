import { runMigrations } from '../db/migrate';
import { TEST_DATABASE_URL } from './test-config';

/** Runs once before the test suite: bring the test database to the latest schema. */
export default async function setup() {
  try {
    await runMigrations(TEST_DATABASE_URL);
  } catch (err) {
    throw new Error(
      `Could not migrate the test database at ${TEST_DATABASE_URL}. Is it running? Try \`pnpm db:up\`.`,
      { cause: err },
    );
  }
}
