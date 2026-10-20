// Bundles the server for production.
// Workspace packages (@pictiotheme/*) ship as TypeScript source, so they are bundled in.
// npm dependencies stay external and are installed in the image with `pnpm deploy --prod`.
import { build } from 'esbuild';
import { cp, readFile, rm } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@pictiotheme/'));

await rm('dist', { recursive: true, force: true });
await build({
  // Doodle Tower's physics worker is its own entry: app.ts loads ./physics.worker.js at runtime.
  entryPoints: {
    main: 'src/main.ts',
    migrate: 'src/migrate.ts',
    'physics.worker': 'src/modules/tower/physics/physics.worker.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external,
  logLevel: 'info',
});
await cp('src/db/migrations', 'dist/migrations', { recursive: true });
// Curated decks are seeded by migrate.js (src/modules/decks/curated-decks.ts).
await cp('src/modules/decks/curated', 'dist/curated', { recursive: true });
// The share card's fonts (src/modules/rooms/share-card.ts).
await cp('src/modules/rooms/share-card-fonts', 'dist/share-card-fonts', { recursive: true });
// Doodle Tower's share card's font (src/modules/tower/tower-share-card.ts).
await cp('src/modules/tower/tower-share-card-fonts', 'dist/tower-share-card-fonts', {
  recursive: true,
});
