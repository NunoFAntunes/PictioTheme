import { describe, expect, it } from 'vitest';
import { isPhone } from './device';

describe('isPhone', () => {
  it.each([
    ['iPhone portrait', 390, 844, true, true],
    ['iPhone landscape', 844, 390, true, true],
    ['iPad mini', 744, 1133, true, false],
    ['iPad', 820, 1180, true, false],
    ['small desktop window', 500, 400, false, false],
  ])('%s', (_name, screenWidth, screenHeight, coarsePointer, phone) => {
    expect(isPhone({ screenWidth, screenHeight, coarsePointer })).toBe(phone);
  });
});
