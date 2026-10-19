import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

// Doodle Tower's own site (docs/tower/technical/architecture.md#frontend): static output, its own
// fonts and tokens. Nothing here is shared with apps/web's look.
export default defineConfig({
  output: 'static',
  integrations: [react()],
  // Self-hosted at build time. Bungee: signage display type. Space Grotesk: UI text.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Bungee',
      cssVariable: '--font-bungee',
      subsets: ['latin'],
      fallbacks: ['Impact', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Space Grotesk',
      cssVariable: '--font-space-grotesk',
      weights: ['400 700'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle at startup so the island doesn't fail once on a re-optimize (see apps/web).
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'react/jsx-dev-runtime',
        '@pictiotheme/canvas-engine > perfect-freehand',
        '@pictiotheme/doodle-shape > poly-decomp-es',
        '@pictiotheme/tower-physics > @dimforge/rapier2d-deterministic-compat',
      ],
    },
  },
});
