import { describe, expect, it } from 'vitest';
import { testConfig } from './test-support/test-config';

describe('theme-check model', () => {
  it('defaults to the deck model, falling back to the deck fallbacks', () => {
    const { openRouter } = testConfig();
    expect(openRouter.themeCheckModel).toBe(openRouter.deckModel);
    expect(openRouter.themeCheckFallbackModels).toEqual(openRouter.fallbackModels);
  });

  it('falls back to the deck model when switched to a cheaper one', () => {
    const { openRouter } = testConfig({ THEME_CHECK_MODEL: 'openai/gpt-oss-20b' });
    expect(openRouter.themeCheckModel).toBe('openai/gpt-oss-20b');
    expect(openRouter.themeCheckFallbackModels).toEqual([
      openRouter.deckModel,
      ...openRouter.fallbackModels,
    ]);
    const own = testConfig({ THEME_CHECK_MODEL: 'a/b', THEME_CHECK_FALLBACK_MODELS: 'c/d, e/f' });
    expect(own.openRouter.themeCheckFallbackModels).toEqual(['c/d', 'e/f']);
  });
});

describe("Doodle Tower's test mode", () => {
  it('is on outside production unless switched off, and off in production unless switched on', () => {
    expect(testConfig().towerTestMode).toBe(true);
    expect(testConfig({ TOWER_TEST_MODE: 'off' }).towerTestMode).toBe(false);
    expect(testConfig({ NODE_ENV: 'production' }).towerTestMode).toBe(false);
    expect(testConfig({ NODE_ENV: 'production', TOWER_TEST_MODE: 'on' }).towerTestMode).toBe(true);
  });
});

describe('the guest cookie domain', () => {
  it('is host-only by default and takes a bare parent domain', () => {
    expect(testConfig().cookieDomain).toBeNull();
    expect(testConfig({ COOKIE_DOMAIN: 'tierney.one' }).cookieDomain).toBe('tierney.one');
    expect(() => testConfig({ COOKIE_DOMAIN: '.tierney.one' })).toThrow(/COOKIE_DOMAIN/);
    expect(() => testConfig({ COOKIE_DOMAIN: 'https://tierney.one' })).toThrow(/COOKIE_DOMAIN/);
  });
});
