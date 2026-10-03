import { describe, expect, it } from 'vitest';
import { seededRng } from './rng';
import { generateRoomCode, isBlockedRoomCode, normalizeRoomCode } from './room-code';

describe('generateRoomCode', () => {
  it('produces ABC-DEF codes without I or O', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 1000; i++) {
      expect(generateRoomCode(rng)).toMatch(/^[A-HJ-NP-Z]{3}-[A-HJ-NP-Z]{3}$/);
    }
  });

  it('never produces a blocked code', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 5000; i++) {
      expect(isBlockedRoomCode(generateRoomCode(rng).replace('-', ''))).toBe(false);
    }
  });
});

describe('isBlockedRoomCode', () => {
  it('finds blocked trigrams anywhere, including across the dash', () => {
    expect(isBlockedRoomCode('XKKKXX')).toBe(true);
    expect(isBlockedRoomCode('XXASSX')).toBe(true);
    expect(isBlockedRoomCode('ABCDEF')).toBe(false);
  });
});

describe('normalizeRoomCode', () => {
  it.each([
    ['abc-def', 'ABC-DEF'],
    ['ABCDEF', 'ABC-DEF'],
    [' abc def ', 'ABC-DEF'],
    ['a.b.c/d e f', 'ABC-DEF'],
  ])('%s → %s', (input, code) => {
    expect(normalizeRoomCode(input)).toEqual({ ok: true, code });
  });

  it('explains that codes never contain I, O, 0 or 1', () => {
    expect(normalizeRoomCode('ABO-DEF')).toEqual({ ok: false, reason: 'ambiguous_letters' });
    expect(normalizeRoomCode('AB0-DEF')).toEqual({ ok: false, reason: 'ambiguous_letters' });
    expect(normalizeRoomCode('ABC-DE1')).toEqual({ ok: false, reason: 'ambiguous_letters' });
  });

  it('rejects the wrong number of letters', () => {
    expect(normalizeRoomCode('ABC-DE')).toEqual({ ok: false, reason: 'wrong_length' });
  });
});
