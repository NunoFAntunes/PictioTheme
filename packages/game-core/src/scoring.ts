import type { Card, Difficulty } from '@pictiotheme/protocol';

/** Scoring rules from docs/product/game-rules.md#scoring. */

const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { easy: 1, medium: 1.2, hard: 1.5 };
const SILLY_MULTIPLIER = 1.5;
const FIRST_GUESS_BONUS = 50;

export function cardMultiplier(card: Pick<Card, 'difficulty' | 'silly'>): number {
  return card.silly ? SILLY_MULTIPLIER : DIFFICULTY_MULTIPLIER[card.difficulty];
}

/** 50–300 for speed, +50 for the first correct guesser, times the card multiplier. */
export function guesserPoints(input: {
  timeRemainingMs: number;
  drawTimeMs: number;
  isFirst: boolean;
  multiplier: number;
}): number {
  const fraction = Math.min(1, Math.max(0, input.timeRemainingMs / input.drawTimeMs));
  const base = 50 + 250 * fraction + (input.isFirst ? FIRST_GUESS_BONUS : 0);
  return Math.round(base * input.multiplier);
}

/** Up to 200, in proportion to how many guessers got it. 0 if nobody did. */
export function drawerPoints(input: {
  correctGuessers: number;
  totalGuessers: number;
  multiplier: number;
}): number {
  if (input.totalGuessers <= 0) return 0;
  return Math.round(200 * (input.correctGuessers / input.totalGuessers) * input.multiplier);
}
