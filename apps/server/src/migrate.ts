import { loadConfig } from './config';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';
import { seedCuratedDecks } from './modules/decks';
import { seedTowerDecks } from './modules/tower';

/**
 * Entrypoint: `pnpm db:migrate` locally, a one-off container before each deploy in production.
 * Applies the migrations, then seeds the curated decks and Doodle Tower's deck allowlist
 * (idempotent).
 */
const config = loadConfig();
await runMigrations(config.databaseUrl);
process.stdout.write('migrations applied\n');
const { db, pool } = createDb(config.databaseUrl);
try {
  process.stdout.write(`curated decks seeded: ${await seedCuratedDecks(db)}\n`);
  process.stdout.write(`tower decks added: ${await seedTowerDecks(db)}\n`);
} finally {
  await pool.end();
}
