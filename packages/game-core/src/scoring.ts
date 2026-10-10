import type { Card, Difficulty } from '@pictiotheme/protocol';

/** Scoring rules from docs/product/game-rules.md#scoring. */

const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { easy: 1, medium: 1.2, hard: 1.5 };
const SILLY_MULTIPLIER = 1.5;
/**
 * The drawer's multiplier is steeper than the guessers': a hard card is less likely to be guessed,
 * and the drawer chose the risk. Picking "Bat" over "Headless horseman" should not be the safe bet.
 */
const DRAWER_DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { easy: 1, medium: 1.4, hard: 2 };
const DRAWER_SILLY_MULTIPLIER = 2;

/** Base points for a correct guess: from 100 at the buzzer to 300 for an instant one. */
const GUESS_MIN = 100;
const GUESS_SPEED = 200;
/** Extra points for the 1st, 2nd and 3rd correct guessers. */
const ORDER_BONUS = [100, 50, 25] as const;

/** The drawer earns this per guesser in the room, counting 2 to 8 guessers. */
const DRAWER_PER_GUESSER = 50;
const DRAWER_MIN_GUESSERS = 2;
const DRAWER_MAX_GUESSERS = 8;
/** Once this share of guessers gets it, the drawer has full points: more doesn't add more. */
const DRAWER_FULL_AT = 0.5;

/** Rush: the window after the first correct guess, a quarter of the draw time, 15 to 30 s. */
const RUSH_SHARE = 0.25;
const RUSH_MIN_MS = 15_000;
const RUSH_MAX_MS = 30_000;

export function cardMultiplier(card: Pick<Card, 'difficulty' | 'silly'>): number {
  return card.silly ? SILLY_MULTIPLIER : DIFFICULTY_MULTIPLIER[card.difficulty];
}

export function drawerMultiplier(card: Pick<Card, 'difficulty' | 'silly'>): number {
  return card.silly ? DRAWER_SILLY_MULTIPLIER : DRAWER_DIFFICULTY_MULTIPLIER[card.difficulty];
}

/** 100–300 for speed, before the order bonus and the multiplier. */
export function speedPoints(timeRemainingMs: number, drawTimeMs: number): number {
  const fraction = Math.min(1, Math.max(0, timeRemainingMs / drawTimeMs));
  return GUESS_MIN + GUESS_SPEED * fraction;
}

/**
 * Rush: what a guess is worth `remainingMs` into a window that started at `fromBase` (the first
 * guesser's speed points). It drains to the minimum as the window closes.
 */
export function rushPoints(fromBase: number, remainingMs: number, windowMs: number): number {
  const fraction = Math.min(1, Math.max(0, remainingMs / windowMs));
  return GUESS_MIN + (fromBase - GUESS_MIN) * fraction;
}

export function rushWindowMs(drawTimeMs: number): number {
  return Math.min(RUSH_MAX_MS, Math.max(RUSH_MIN_MS, drawTimeMs * RUSH_SHARE));
}

/** `order` is 1 for the first correct guesser. */
export function orderBonus(order: number): number {
  return ORDER_BONUS[order - 1] ?? 0;
}

/** Speed points plus the order bonus, times the card multiplier. */
export function guesserPoints(input: { base: number; order: number; multiplier: number }): number {
  return Math.round((input.base + orderBonus(input.order)) * input.multiplier);
}

/**
 * Up to 50 per guesser (2 to 8 of them), full once half the guessers got it, times the drawer's
 * multiplier. 0 if nobody did. Speed doesn't count: it would favour the easiest cards again.
 */
export function drawerPoints(input: {
  correctGuessers: number;
  totalGuessers: number;
  multiplier: number;
}): number {
  const { correctGuessers, totalGuessers } = input;
  if (totalGuessers <= 0 || correctGuessers <= 0) return 0;
  const share = Math.min(1, correctGuessers / totalGuessers / DRAWER_FULL_AT);
  const guessers = Math.min(DRAWER_MAX_GUESSERS, Math.max(DRAWER_MIN_GUESSERS, totalGuessers));
  return Math.round(DRAWER_PER_GUESSER * guessers * share * input.multiplier);
}
