// Bundles the server for production.
// Workspace packages (@pictiotheme/*) ship as TypeScript source, so they are bundled in.
// npm dependencies stay external and are installed in the image with `pnpm deploy --prod`.
import { build } from 'esbuild';
import { cp, readFile, rm } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@pictiotheme/'));

await rm('dist', { recursive: true, force: true });
await build({
  entryPoints: ['src/main.ts', 'src/migrate.ts'],
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
