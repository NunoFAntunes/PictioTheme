import { describe, expect, it } from 'vitest';
import { EMOTE_CHARGES, EMOTE_REFILL_MS, emoteChargesAt } from './emote';

describe('emoteChargesAt', () => {
  const empty = { left: 0, refillAt: 1_000, readyAt: 500 };

  it('brings charges back one at a time, as time passes', () => {
    expect(emoteChargesAt(empty, 999)).toEqual(empty);
    expect(emoteChargesAt(empty, 1_000)).toEqual({
      left: 1,
      refillAt: 1_000 + EMOTE_REFILL_MS,
      readyAt: 500,
    });
    expect(emoteChargesAt(empty, 1_000 + EMOTE_REFILL_MS).left).toBe(2);
  });

  it('stops at the maximum', () => {
    const full = emoteChargesAt(empty, 1_000 + 10 * EMOTE_REFILL_MS);
    expect(full).toEqual({ left: EMOTE_CHARGES, refillAt: null, readyAt: 500 });
  });
});
