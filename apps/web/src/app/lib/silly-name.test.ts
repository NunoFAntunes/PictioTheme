import { hasProfanity } from '@pictiotheme/moderation';
import { DisplayName } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { isSillyName, SILLY_NAME_PARTS, sillyName } from './silly-name';

describe('sillyName', () => {
  it('pairs an adjective with a noun', () => {
    expect(sillyName(() => 0)).toBe('Sneaky Pickle');
    expect(sillyName(() => 0.999)).toBe('Swirly Teapot');
  });

  it('only ever makes valid, clean display names', () => {
    for (const adjective of SILLY_NAME_PARTS.adjectives) {
      for (const noun of SILLY_NAME_PARTS.nouns) {
        const name = `${adjective} ${noun}`;
        expect(DisplayName.safeParse(name).success, name).toBe(true);
        expect(hasProfanity(name), name).toBe(false);
      }
    }
  });
});

describe('isSillyName', () => {
  it('recognises made-up names, and nothing else', () => {
    expect(isSillyName(sillyName(() => 0.5))).toBe(true);
    expect(isSillyName('Ana')).toBe(false);
    expect(isSillyName('Sneaky Ana')).toBe(false);
    expect(isSillyName('Sneaky Pickle Jr')).toBe(false);
  });
});
