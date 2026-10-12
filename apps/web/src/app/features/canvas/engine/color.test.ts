import { describe, expect, it } from 'vitest';
import { PALETTE } from '../tools';
import {
  hexToHsv,
  HOLD_DEAD_ZONE,
  holdColor,
  holdHue,
  hsvFor,
  hsvToHex,
  hueAt,
  parseHex,
  shadesOf,
  svAt,
  WHEEL_OFFSET,
  WHEEL_SIZE,
  WHEEL_SQUARE,
  wheelPart,
  withWheelPart,
} from './color';

describe('parseHex', () => {
  it('accepts 3 or 6 digits, with or without #, in any case', () => {
    expect(parseHex('#DC2626')).toBe('#dc2626');
    expect(parseHex('dc2626')).toBe('#dc2626');
    expect(parseHex(' #f0a ')).toBe('#ff00aa');
  });

  it('rejects anything else', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('#dc262')).toBeNull();
    expect(parseHex('red')).toBeNull();
  });
});

describe('hex ↔ HSV', () => {
  it('reads the primaries', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#00ff00')).toEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv('#0000ff')).toEqual({ h: 240, s: 1, v: 1 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
  });

  it('round-trips every palette colour exactly', () => {
    for (const { hex } of PALETTE) expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });

  it('wraps hue at 360', () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
  });
});

describe('hsvFor', () => {
  const blue = hexToHsv('#3b82f6');

  it('keeps the hue for greys, black and white', () => {
    expect(hsvFor('#808080', blue).h).toBe(blue.h);
    expect(hsvFor('#ffffff', blue)).toEqual({ h: blue.h, s: 0, v: 1 });
  });

  it('keeps hue and saturation for black', () => {
    expect(hsvFor('#000000', blue)).toEqual({ h: blue.h, s: blue.s, v: 0 });
  });

  it('takes a real colour as it is', () => {
    expect(hsvFor('#ff0000', blue)).toEqual({ h: 0, s: 1, v: 1 });
  });
});

describe('wheel geometry', () => {
  it('puts red at the top and runs clockwise', () => {
    expect(hueAt(0, -10)).toBe(0);
    expect(hueAt(10, 0)).toBe(90);
    expect(hueAt(0, 10)).toBe(180);
    expect(hueAt(-10, 0)).toBe(270);
  });

  it('reads saturation left to right and value bottom to top, clamped', () => {
    expect(svAt(0, 0, 100)).toEqual({ s: 0, v: 1 });
    expect(svAt(100, 100, 100)).toEqual({ s: 1, v: 0 });
    expect(svAt(-20, 150, 100)).toEqual({ s: 0, v: 0 });
  });
});

describe('wheelPart', () => {
  const mid = WHEEL_SIZE / 2;

  it('finds the ring, with its hue', () => {
    expect(wheelPart(mid, 4)).toEqual({ part: 'hue', h: 0 });
    expect(wheelPart(WHEEL_SIZE - 4, mid)).toEqual({ part: 'hue', h: 90 });
  });

  it('finds the square, with saturation and value', () => {
    expect(wheelPart(WHEEL_OFFSET + WHEEL_SQUARE, WHEEL_OFFSET)).toEqual({
      part: 'sv',
      s: 1,
      v: 1,
    });
    expect(wheelPart(mid, mid)).toEqual({ part: 'sv', s: 0.5, v: 0.5 });
  });

  it('finds nothing in the gap, the corners or outside', () => {
    expect(wheelPart(mid, WHEEL_OFFSET - 3)).toBeNull();
    expect(wheelPart(2, 2)).toBeNull();
    expect(wheelPart(-50, mid)).toBeNull();
  });

  it('applies a part to a colour', () => {
    const red = hexToHsv('#ff0000');
    expect(hsvToHex(withWheelPart(red, { part: 'hue', h: 240 }))).toBe('#0000ff');
    expect(hsvToHex(withWheelPart(red, { part: 'sv', s: 0, v: 1 }))).toBe('#ffffff');
  });
});

describe('shadesOf', () => {
  it('runs from darker to lighter around the colour itself', () => {
    const shades = shadesOf('#3b82f6');
    expect(shades).toHaveLength(7);
    expect(shades[3]).toBe('#3b82f6');
    const light = shades.map((h) => hexToHsv(h).v + (1 - hexToHsv(h).s));
    for (let i = 1; i < light.length; i++) expect(light[i]).toBeGreaterThan(light[i - 1] ?? 0);
  });

  it('keeps black and white in range', () => {
    expect(shadesOf('#000000')[0]).toBe('#000000');
    expect(shadesOf('#ffffff')[6]).toBe('#ffffff');
  });
});

describe('the hold', () => {
  it('points at a hue by direction, over the square too', () => {
    expect(holdHue(0, -30)).toBe(0);
    expect(holdHue(30, 0)).toBe(90);
    expect(holdHue(0, 70)).toBe(180);
  });

  it('changes nothing in the dead zone or past the ring', () => {
    expect(holdHue(0, HOLD_DEAD_ZONE - 1)).toBeNull();
    expect(holdHue(WHEEL_SIZE / 2 + 20, 0)).toBe(90);
    expect(holdHue(-(WHEEL_SIZE / 2 + 40), 0)).toBeNull();
  });

  it("keeps a colour's saturation and brightness", () => {
    expect(holdColor(hexToHsv('#dc2626'), 120)).toBe('#26dc26');
  });

  it('lifts greys and near-black so the hue shows', () => {
    expect(holdColor(hexToHsv('#000000'), 0)).toBe('#993d3d');
    expect(holdColor(hexToHsv('#ffffff'), 240)).toBe('#6666ff');
  });
});
