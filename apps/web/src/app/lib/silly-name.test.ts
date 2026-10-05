import { hasProfanity } from '@pictiotheme/game-core';
import { DisplayName } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { SILLY_NAME_PARTS, sillyName } from './silly-name';

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
