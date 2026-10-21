import { describe, expect, it } from 'vitest';
import { siteUrl } from './index';

describe('siteUrl', () => {
  it('is the local dev server in development and the subdomain in a build', () => {
    expect(siteUrl('portal', { DEV: true })).toBe('http://localhost:4323');
    expect(siteUrl('tower', { DEV: false })).toBe('https://tower.tierney.one');
  });

  it('lets a build point a site elsewhere', () => {
    const env = { DEV: false, PUBLIC_DOODLE_URL: 'https://doodle.example' };
    expect(siteUrl('doodle', env)).toBe('https://doodle.example');
    expect(siteUrl('doodle', { DEV: false, PUBLIC_DOODLE_URL: '' })).toBe(
      'https://doodle.tierney.one',
    );
  });
});
