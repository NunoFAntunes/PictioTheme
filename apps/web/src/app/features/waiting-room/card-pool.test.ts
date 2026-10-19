import { DEFAULT_ROOM_SETTINGS } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { CARD_POOLS, cardPoolOf, cardPoolSettings } from './card-pool';

describe('cardPoolOf', () => {
  it('recognises the default settings as Easy', () => {
    expect(cardPoolOf(DEFAULT_ROOM_SETTINGS)).toBe('easy');
  });

  it('is Chaos whatever the difficulties', () => {
    expect(cardPoolOf({ mode: 'chaos', difficulties: ['hard'] })).toBe('chaos');
  });

  it('is the one difficulty when only one is on', () => {
    expect(cardPoolOf({ mode: 'normal', difficulties: ['easy'] })).toBe('easy');
    expect(cardPoolOf({ mode: 'normal', difficulties: ['hard'] })).toBe('hard');
  });
});

describe('cardPoolSettings', () => {
  it('round-trips every pool', () => {
    for (const { id } of CARD_POOLS) {
      const settings: Parameters<typeof cardPoolOf>[0] = {
        mode: 'normal',
        difficulties: ['easy'],
        ...cardPoolSettings(id),
      };
      expect(cardPoolOf(settings)).toBe(id);
    }
  });

  it('leaves the difficulties alone for Chaos', () => {
    expect(cardPoolSettings('chaos')).toEqual({ mode: 'chaos' });
  });
});
