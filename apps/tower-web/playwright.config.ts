import { defineConfig, devices } from '@playwright/test';

/** Browser tests against the Astro dev server, in the installed Google Chrome. No backend needed. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4322',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'pnpm dev:foreground',
    url: 'http://localhost:4322/sandbox',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
