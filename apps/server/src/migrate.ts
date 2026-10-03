import { loadConfig } from './config';
import { runMigrations } from './db/migrate';

/** Entrypoint: `pnpm db:migrate` locally, a one-off container before each deploy in production. */
const config = loadConfig();
await runMigrations(config.databaseUrl);
process.stdout.write('migrations applied\n');
