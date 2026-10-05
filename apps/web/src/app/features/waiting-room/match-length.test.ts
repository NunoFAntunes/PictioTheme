import { DEFAULT_ROOM_SETTINGS } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { maxMatchMinutes, paceOf } from './match-length';

describe('maxMatchMinutes', () => {
  it('counts every player drawing once a round, with the choosing and reveal time', () => {
    // 3 rounds × 4 players × (10 s choosing + 80 s drawing + 5 s reveal) = 19 min.
    expect(maxMatchMinutes({ rounds: 3, drawSeconds: 80, wordChoice: 3 }, 4)).toBe(19);
  });

  it('skips the choosing time when the drawer gets one card', () => {
    // 2 × 2 × (60 + 5) s = 4.3 min.
    expect(maxMatchMinutes({ rounds: 2, drawSeconds: 60, wordChoice: 1 }, 2)).toBe(4);
  });

  it('assumes at least two players, since a match needs them', () => {
    const settings = { rounds: 1, drawSeconds: 30, wordChoice: 1 } as const;
    expect(maxMatchMinutes(settings, 1)).toBe(maxMatchMinutes(settings, 2));
  });
});

describe('paceOf', () => {
  it('recognises the default settings as Classic', () => {
    expect(paceOf(DEFAULT_ROOM_SETTINGS)).toBe('classic');
  });

  it('is null for hand-tuned settings', () => {
    expect(paceOf({ rounds: 4, drawSeconds: 80 })).toBeNull();
  });
});
