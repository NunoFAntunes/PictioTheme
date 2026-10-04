import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Static output: Caddy serves dist/ and rewrites app routes to /app (docs/technical/frontend-guidelines.md).
// In dev, src/middleware.ts does that rewrite, and the proxy below makes the API same-origin.
export default defineConfig({
  output: 'static',
  integrations: [react()],
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
