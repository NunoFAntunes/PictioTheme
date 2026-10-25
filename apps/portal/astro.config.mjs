import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

// The games portal (docs/technical/decisions.md D13): every game we publish, and the profile they
// share. Static output like the games; Caddy serves it and proxies /api to the same server.
export default defineConfig({
  output: 'static',
  integrations: [react()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Nunito',
      cssVariable: '--font-nunito',
      weights: ['400 900'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    // The games' logos, as on their own home pages: DoodleWhirl's sticker letters, Doodle Tower's.
    {
      provider: fontProviders.google(),
      name: 'Cherry Bomb One',
      cssVariable: '--font-cherry-bomb',
      subsets: ['latin'],
      fallbacks: ['ui-rounded', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Lilita One',
      cssVariable: '--font-lilita',
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    // The handwriting on the "you" sticker (@pictiotheme/account/ui), as in DoodleWhirl.
    {
      provider: fontProviders.google(),
      name: 'Gochi Hand',
      cssVariable: '--font-gochi-hand',
      subsets: ['latin'],
      fallbacks: ['cursive'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    // The API, same-origin in dev like in production. PORTAL_API_PORT points at a server on
    // another port when 3000 is taken.
    server: {
      proxy: { '/api': `http://localhost:${process.env.PORTAL_API_PORT ?? 3000}` },
    },
    // Pre-bundle at startup so the islands don't fail once on a re-optimize (see apps/web).
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'react/jsx-dev-runtime',
        '@pictiotheme/account > zustand',
        '@pictiotheme/account > zustand/vanilla',
        '@pictiotheme/account > zod',
        '@pictiotheme/account > @pictiotheme/canvas-engine > perfect-freehand',
        '@pictiotheme/drawing-ui > zustand',
      ],
    },
  },
});
