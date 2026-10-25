import { typed } from './timeline';

/**
 * What happens when in the loops that act out the player's side: the guesses typed on the "Guess
 * it" page, and the keys pressed on the "Place it" page. Pure, so the pictures and the tests read
 * the same script.
 */

export type Verdict = 'wrong' | 'close' | 'right';

/** Three guesses at a house: wrong, close, right (game-rules.md#guessing). */
export const GUESSES = [
  { word: 'hat', from: 1400, verdict: 'wrong' },
  { word: 'horse', from: 2800, verdict: 'close' },
  { word: 'house', from: 4500, verdict: 'right' },
] as const satisfies readonly { word: string; from: number; verdict: Verdict }[];

const PER_CHAR = 110;
/** From the last letter to pressing Enter. */
const PAUSE = 250;
/** How long a wrong or close verdict shows before the line clears. */
const SHOWN = 600;

const sentAt = (g: (typeof GUESSES)[number]) => g.from + g.word.length * PER_CHAR + PAUSE;

/** When the right guess (the last) goes in: the drawing becomes a block. */
export const SOLVED_AT = sentAt(GUESSES[2]);

/** The guess line at `t`: what's typed, and the verdict once it's sent (from `since`). */
export function guessLineAt(t: number): { text: string; verdict: Verdict | null; since: number } {
  const guess = [...GUESSES].reverse().find((g) => g.from <= t);
  if (!guess) return { text: '', verdict: null, since: 0 };
  const sent = sentAt(guess);
  if (t < sent)
    return { text: typed(guess.word, guess.from, PER_CHAR, t), verdict: null, since: 0 };
  if (guess.verdict === 'right' || t < sent + SHOWN)
    return { text: guess.word, verdict: guess.verdict, since: sent };
  return { text: '', verdict: null, since: 0 };
}

/** The letter mask shows a third of the way in, then a letter; all of it once it's solved. */
export const MASK_AT = 1000;
export const HINT_AT = 2300;
export function maskAt(t: number): string | null {
  if (t < MASK_AT) return null;
  if (t >= SOLVED_AT) return 'HOUSE';
  return t >= HINT_AT ? '____E' : '_____';
}

export type PlaceKey = 'left' | 'right' | 'turn' | 'drop';

/** Line the boot up over the tower: right, right, turn it level, drop. */
export const PLACE_KEYS: readonly { key: PlaceKey; at: number }[] = [
  { key: 'right', at: 700 },
  { key: 'right', at: 1200 },
  { key: 'turn', at: 2000 },
  { key: 'turn', at: 2500 },
  { key: 'drop', at: 3300 },
];

/** Where the piece starts: a metre left of the middle, tipped 30° anticlockwise. */
export const PLACE_START = { x: -1, angle: -Math.PI / 6 };
/** One press: half a metre sideways, or 15° clockwise (game-rules.md#placing). */
const STEP = 0.5;
const TURN = Math.PI / 12;
/** A press moves the piece over this long, and lights its key for this long. */
const MOVE_MS = 180;
const LIT_MS = 260;
/** Metres a second the piece lowers on its own while it's being placed. */
const LOWERING = 0.25;

export const DROP_AT = PLACE_KEYS.find((p) => p.key === 'drop')?.at ?? Infinity;

/**
 * The piece being placed at `t`: metres from the tower's middle, its angle (radians, clockwise
 * on screen), how far it has lowered on its own, and the key lit up.
 */
export function placingAt(t: number): {
  x: number;
  angle: number;
  lowered: number;
  pressed: PlaceKey | null;
} {
  let { x, angle } = PLACE_START;
  let pressed: PlaceKey | null = null;
  for (const p of PLACE_KEYS) {
    if (t < p.at) break;
    const k = Math.min(1, (t - p.at) / MOVE_MS);
    if (p.key === 'right') x += STEP * k;
    if (p.key === 'left') x -= STEP * k;
    if (p.key === 'turn') angle += TURN * k;
    if (t < p.at + LIT_MS) pressed = p.key;
  }
  return { x, angle, lowered: (Math.min(t, DROP_AT) / 1000) * LOWERING, pressed };
}

/**
 * Bouncy (CURSE_TUNING.restitution): how high above where it lands a piece is, `t` ms after it's
 * let go from `drop` px up, taking `fall` ms to come down. Each bounce leaves at `restitution`
 * times the speed it landed with, so each one goes `restitution²` as high as the one before.
 */
export function bounceHeight(t: number, drop: number, fall: number, restitution: number): number {
  if (t <= 0) return drop;
  const g = (2 * drop) / fall ** 2;
  if (t < fall) return drop - 0.5 * g * t * t;
  let at = fall;
  // The last bounces are too small to see: stop once one is under a pixel.
  for (let v = g * fall * restitution; (v * v) / (2 * g) > 1; v *= restitution) {
    const air = (2 * v) / g;
    if (t < at + air) {
      const s = t - at;
      return v * s - 0.5 * g * s * s;
    }
    at += air;
  }
  return 0;
}
