import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

/** Keep in sync with src/app/features/player-list/name-font.ts and <Font> in src/pages/app.astro. */
const NAME_FONTS = [
  ['Rock Salt', '--font-rock-salt'],
  ['Gloria Hallelujah', '--font-gloria-hallelujah'],
  ['Gochi Hand', '--font-gochi-hand'],
  ['Schoolbell', '--font-schoolbell'],
  ['Kranky', '--font-kranky'],
  ['Sedgwick Ave', '--font-sedgwick-ave'],
  ['Walter Turncoat', '--font-walter-turncoat'],
  ['Covered By Your Grace', '--font-covered-by-your-grace'],
  ['Just Me Again Down Here', '--font-just-me-again-down-here'],
  ['Fuzzy Bubbles', '--font-fuzzy-bubbles'],
];

// Static output: Caddy serves dist/ and rewrites app routes to /app (docs/technical/frontend-guidelines.md).
// In dev, src/middleware.ts does that rewrite, and the proxy below makes the API same-origin.
export default defineConfig({
  output: 'static',
  integrations: [react()],
  // Self-hosted at build time (no runtime Google request). The logo font (see <Font> in index.astro)
  // and the messy handwriting fonts players' names are written in (see app.astro, name-font.ts).
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Cherry Bomb One',
      cssVariable: '--font-cherry-bomb',
      fallbacks: ['ui-rounded', 'system-ui', 'sans-serif'],
    },
    ...NAME_FONTS.map(([name, cssVariable]) => ({
      provider: fontProviders.google(),
      name,
      cssVariable,
      subsets: ['latin'],
      fallbacks: ['cursive'],
    })),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle the app's dependencies at startup. Otherwise Vite discovers them on the first
    // page load, re-optimizes, and the island import fails once ("504 Outdated Optimize Dep").
    // Add new runtime dependencies of src/app here.
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'react/jsx-dev-runtime',
        'react-router',
        '@tanstack/react-query',
        'zustand',
        'zod',
        'perfect-freehand',
        'pluralize',
      ],
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
        '/ws': { target: 'ws://localhost:3000', ws: true },
      },
    },
  },
});
