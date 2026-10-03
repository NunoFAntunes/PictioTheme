import { randomInt, type Rng } from './rng';

/**
 * Word blanks and hints. Rules: docs/product/game-rules.md#hints.
 * Only letters are hidden. Spaces, hyphens and digits are visible from the start.
 */

const LETTER = /\p{L}/u;

function letterIndices(word: string): number[] {
  const out: number[] = [];
  [...word].forEach((ch, i) => {
    if (LETTER.test(ch)) out.push(i);
  });
  return out;
}

/** `"Witch hat"` with nothing revealed → `"_____ ___"`. Indices are code-point positions. */
export function buildMask(word: string, revealed: ReadonlySet<number> = new Set()): string {
  return [...word].map((ch, i) => (LETTER.test(ch) && !revealed.has(i) ? '_' : ch)).join('');
}

/** At most a third of the letters, so a hint never gives the whole word away. */
export function maxHints(word: string): number {
  return Math.floor(letterIndices(word).length / 3);
}

/** A random hidden letter to reveal next, or `null` if the hint budget is used up. */
export function pickHintIndex(
  word: string,
  revealed: ReadonlySet<number>,
  rng: Rng,
): number | null {
  if (revealed.size >= maxHints(word)) return null;
  const hidden = letterIndices(word).filter((i) => !revealed.has(i));
  if (hidden.length === 0) return null;
  return hidden[randomInt(rng, hidden.length)] ?? null;
}
