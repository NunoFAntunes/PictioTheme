import { describe, expect, it } from 'vitest';
import {
  bounceHeight,
  DROP_AT,
  guessLineAt,
  HINT_AT,
  maskAt,
  PLACE_START,
  placingAt,
  SOLVED_AT,
} from './scripts';
import { easeOutBack, ring, span, typed } from './timeline';

describe('timeline', () => {
  it('spans, eases and types', () => {
    expect([span(0, 100, 200), span(150, 100, 200), span(300, 100, 200)]).toEqual([0, 0.5, 1]);
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    expect(typed('house', 1000, 100, 999)).toBe('');
    expect(typed('house', 1000, 100, 1000)).toBe('h');
    expect(typed('house', 1000, 100, 1250)).toBe('hou');
    expect(typed('house', 1000, 100, 9000)).toBe('house');
  });

  it('rings only for its time, and dies out', () => {
    expect(ring(99, 100, 300, 10)).toBe(0);
    expect(ring(401, 100, 300, 10)).toBe(0);
    expect(Math.abs(ring(380, 100, 300, 10))).toBeLessThan(1);
  });
});

describe('the guess line', () => {
  it('types, sends and clears a wrong guess, then a close one', () => {
    expect(guessLineAt(0)).toEqual({ text: '', verdict: null, since: 0 });
    expect(guessLineAt(1600).text).toBe('ha');
    expect(guessLineAt(2000)).toMatchObject({ text: 'hat', verdict: 'wrong' });
    expect(guessLineAt(2700)).toEqual({ text: '', verdict: null, since: 0 });
    expect(guessLineAt(3700)).toMatchObject({ text: 'horse', verdict: 'close' });
  });

  it('keeps the right guess, and the word shows in full', () => {
    expect(guessLineAt(SOLVED_AT - 1).verdict).toBeNull();
    expect(guessLineAt(SOLVED_AT)).toEqual({ text: 'house', verdict: 'right', since: SOLVED_AT });
    expect(guessLineAt(SOLVED_AT + 5000).verdict).toBe('right');
    expect(maskAt(0)).toBeNull();
    expect(maskAt(HINT_AT - 1)).toBe('_____');
    expect(maskAt(HINT_AT)).toBe('____E');
    expect(maskAt(SOLVED_AT)).toBe('HOUSE');
  });
});

describe('placing', () => {
  it('starts off to the left and tipped', () => {
    expect(placingAt(0)).toEqual({ ...PLACE_START, lowered: 0, pressed: null });
  });

  it('moves right twice, turns level, then drops', () => {
    expect(placingAt(1600).x).toBeCloseTo(0);
    expect(placingAt(1250).pressed).toBe('right');
    expect(placingAt(2100).pressed).toBe('turn');
    expect(placingAt(3000).angle).toBeCloseTo(0);
    expect(placingAt(DROP_AT).pressed).toBe('drop');
  });

  it('lowers on its own until it is dropped', () => {
    expect(placingAt(2000).lowered).toBeCloseTo(0.5);
    expect(placingAt(DROP_AT + 2000).lowered).toBeCloseTo(placingAt(DROP_AT).lowered);
  });
});

describe('bouncing', () => {
  const at = (t: number) => bounceHeight(t, 100, 500, 0.6);

  it('falls, lands, and goes back up 0.6² as high', () => {
    expect(at(0)).toBe(100);
    expect(at(500)).toBeCloseTo(0);
    // The first bounce leaves at 0.6 of the landing speed: up 300 ms, down 300 ms.
    expect(at(800)).toBeCloseTo(36);
    expect(at(1100)).toBeCloseTo(0);
  });

  it('settles', () => {
    expect(at(10_000)).toBe(0);
  });
});
