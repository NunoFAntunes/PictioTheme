import { loadConfig, type Config } from '../config';

/** Tests run against the real `pictiotheme_test` database from infra/compose.dev.yaml (no DB mocks). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://pictio:pictio@localhost:5433/pictiotheme_test';

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    ...overrides,
  });
}
