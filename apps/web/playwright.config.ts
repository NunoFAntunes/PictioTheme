import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the real dev stack (Astro dev server + Fastify server).
 * Every spec runs in the installed Google Chrome (`channel: 'chrome'`). Specs about raw input
 * (`CROSS_BROWSER`) also run in Firefox and WebKit (Safari's engine), which need
 * `pnpm --filter @pictiotheme/web exec playwright install firefox webkit` once.
 * The server needs its env (see apps/server/.env.example) and Postgres (`pnpm db:up`).
 */

const CROSS_BROWSER = /(brush-controls|color-shortcuts)\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:4321',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    // Each new context loads every unbundled dev module from cold, and these engines are much
    // slower at it on CI: in WebKit, `startTurn` alone has taken 57s of a 60s budget.
    {
      name: 'firefox',
      use: devices['Desktop Firefox'],
      testMatch: CROSS_BROWSER,
      timeout: 120_000,
    },
    {
      name: 'webkit',
      use: devices['Desktop Safari'],
      testMatch: CROSS_BROWSER,
      timeout: 120_000,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @pictiotheme/server dev',
      url: 'http://localhost:3000/api/health',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // --ignore-lock keeps Astro in the foreground: it auto-backgrounds when it detects an AI
      // agent, which makes Playwright think the server exited and leaves it running afterwards.
      command: 'pnpm --filter @pictiotheme/web dev:foreground',
      url: 'http://localhost:4321',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
