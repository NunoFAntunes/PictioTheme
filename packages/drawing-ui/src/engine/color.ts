/**
 * Colour maths for the colour wheel (drawing-tools.md#picking-and-sampling-colours): hex ↔ HSV,
 * and where a point on the wheel lands. Hue is in degrees, clockwise from the top (red), the same
 * way a CSS `conic-gradient` runs. Saturation and value are 0..1.
 */

export type Hsv = { h: number; s: number; v: number };

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

/** `#rrggbb` (lowercase) from what someone typed: with or without `#`, 3 or 6 digits. */
export function parseHex(text: string): string | null {
  const m = HEX.exec(text.trim());
  if (!m?.[1]) return null;
  const digits = m[1].length === 3 ? [...m[1]].map((d) => d + d).join('') : m[1];
  return `#${digits.toLowerCase()}`;
}

export function hexToHsv(hex: string): Hsv {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (k: number) => {
    const at = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(at, 4 - at, 1));
  };
  return `#${[f(5), f(3), f(1)]
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * The HSV to show for `hex`. Greys, black and white have no hue of their own (and black has no
 * saturation), so they keep the ones already on the wheel instead of jumping back to red.
 */
export function hsvFor(hex: string, previous: Hsv): Hsv {
  const next = hexToHsv(hex);
  if (next.v === 0) return { h: previous.h, s: previous.s, v: 0 };
  if (next.s === 0) return { ...next, h: previous.h };
  return next;
}

/** The hue at an offset from the wheel's centre: 0 straight up, growing clockwise. */
export function hueAt(dx: number, dy: number): number {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Saturation (left to right) and value (bottom to top) at a point of the square, clamped. */
export function svAt(x: number, y: number, side: number): { s: number; v: number } {
  return { s: clamp01(x / side), v: clamp01(1 - y / side) };
}

/** The wheel's size: a hue ring of `ring` px around a square inscribed with a little air. */
export const WHEEL_SIZE = 160;
export const WHEEL_RING = 16;
const INNER = WHEEL_SIZE / 2 - WHEEL_RING;
export const WHEEL_SQUARE = Math.floor((INNER - 4) * Math.SQRT2);
export const WHEEL_OFFSET = (WHEEL_SIZE - WHEEL_SQUARE) / 2;

export type WheelPart = { part: 'hue'; h: number } | { part: 'sv'; s: number; v: number };

/** What is at a point of the wheel (relative to its box): the ring, the square, or nothing. */
export function wheelPart(x: number, y: number): WheelPart | null {
  const dx = x - WHEEL_SIZE / 2;
  const dy = y - WHEEL_SIZE / 2;
  const r = Math.hypot(dx, dy);
  if (r >= INNER - 2 && r <= WHEEL_SIZE / 2 + 2) return { part: 'hue', h: hueAt(dx, dy) };
  const sx = x - WHEEL_OFFSET;
  const sy = y - WHEEL_OFFSET;
  if (sx >= 0 && sx <= WHEEL_SQUARE && sy >= 0 && sy <= WHEEL_SQUARE)
    return { part: 'sv', ...svAt(sx, sy, WHEEL_SQUARE) };
  return null;
}

/** `base` with that part of the wheel applied: the ring sets the hue, the square the rest. */
export function withWheelPart(base: Hsv, hit: WheelPart): Hsv {
  return hit.part === 'hue' ? { ...base, h: hit.h } : { h: base.h, s: hit.s, v: hit.v };
}

function mix(hex: string, toward: number, t: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `#${[16, 8, 0]
    .map((shift) => {
      const c = (n >> shift) & 255;
      return Math.round(c + (toward - c) * t)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

/** Three darker, the colour itself, three lighter: mixed toward black and toward white. */
export function shadesOf(hex: string): string[] {
  return [
    mix(hex, 0, 0.6),
    mix(hex, 0, 0.4),
    mix(hex, 0, 0.2),
    hex,
    mix(hex, 255, 0.25),
    mix(hex, 255, 0.5),
    mix(hex, 255, 0.75),
  ];
}

/** During a hold, the centre (px) where nothing changes yet: holding still keeps the colour. */
export const HOLD_DEAD_ZONE = 16;
/**
 * Where the hold's hue zone ends: past the recent colours on their ring around the wheel (they're
 * picked first when the pointer is on one), so overshooting between two still points at a hue.
 */
const HOLD_REACH = WHEEL_SIZE / 2 + 32;

/**
 * The hue a hold points at, by direction from the wheel's centre: anywhere from the dead zone out
 * past the recent colours, over the square too, so a flick can't miss the ring or cross the square.
 */
export function holdHue(dx: number, dy: number): number | null {
  const r = Math.hypot(dx, dy);
  return r >= HOLD_DEAD_ZONE && r < HOLD_REACH ? hueAt(dx, dy) : null;
}

/**
 * Saturation and brightness for a hold's hue: the colour's own, lifted when it's too grey or too
 * dark for a hue to show (black flicked toward red gives a red, not black).
 */
export function holdColor(base: Hsv, h: number): string {
  return hsvToHex({ h, s: base.s < 0.25 ? 0.6 : base.s, v: base.v < 0.35 ? 0.6 : base.v });
}
