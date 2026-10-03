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
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
        '/ws': { target: 'ws://localhost:3000', ws: true },
      },
    },
  },
});
