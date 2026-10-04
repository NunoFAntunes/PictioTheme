import { defineConfig } from 'vitest/config';

// Unit tests for pure modules (engine, reducers). Browser flows are covered by Playwright in e2e/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
