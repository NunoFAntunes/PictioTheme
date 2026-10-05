import { describe, expect, it } from 'vitest';
import { NAME_FONTS, nameFont, playerHash } from './name-font';

describe('nameFont', () => {
  it('is the same for the same player in the same room', () => {
    expect(nameFont('player-1', 'ABCD')).toBe(nameFont('player-1', 'ABCD'));
  });

  it('spreads players across the fonts', () => {
    const used = new Set(
      Array.from({ length: 200 }, (_, i) => nameFont(`player-${i}`, 'ABCD').family),
    );
    expect(used.size).toBe(NAME_FONTS.length);
  });

  it('can change between rooms', () => {
    const rooms = ['ABCD', 'EFGH', 'IJKL', 'MNOP', 'QRST'];
    const families = new Set(rooms.map((room) => nameFont('player-1', room).family));
    expect(families.size).toBeGreaterThan(1);
  });
});

describe('playerHash', () => {
  it('separates its parts', () => {
    expect(playerHash('ab', 'c')).not.toBe(playerHash('a', 'bc'));
  });
});
