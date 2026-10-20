import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

// Doodle Tower's own site (docs/tower/technical/architecture.md#frontend): static output, its own
// fonts and tokens. Nothing here is shared with apps/web's look.
export default defineConfig({
  output: 'static',
  integrations: [react()],
  // Self-hosted at build time. Lilita One: chunky, rounded display type. Fredoka: friendly UI text.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Lilita One',
      cssVariable: '--font-lilita',
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Fredoka',
      cssVariable: '--font-fredoka',
      weights: ['400 700'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    // The API and the tower socket, same-origin in dev like in production. TOWER_API_PORT points
    // at a server on another port when 3000 is taken.
    server: {
      proxy: {
        '/api': `http://localhost:${process.env.TOWER_API_PORT ?? 3000}`,
        '/ws': { target: `ws://localhost:${process.env.TOWER_API_PORT ?? 3000}`, ws: true },
      },
    },
    // Pre-bundle at startup so the island doesn't fail once on a re-optimize (see apps/web).
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'react/jsx-dev-runtime',
        'zustand',
        'zod',
        '@pictiotheme/canvas-engine > perfect-freehand',
        '@pictiotheme/doodle-shape > poly-decomp-es',
        '@pictiotheme/tower-physics > @dimforge/rapier2d-deterministic-compat',
      ],
    },
  },
});
