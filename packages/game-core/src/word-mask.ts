import { randomInt, type Rng } from './rng';

/**
 * Word blanks and hints. Rules: docs/product/game-rules.md#hints.
 * Only letters are hidden. Spaces, hyphens and digits are visible from the start.
 */

const LETTER = /\p{L}/u;

/** `"Witch hat"` with nothing revealed → `"_____ ___"`. Indices are code-point positions. */
export function buildMask(word: string, revealed: ReadonlySet<number> = new Set()): string {
  return [...word].map((ch, i) => (LETTER.test(ch) && !revealed.has(i) ? '_' : ch)).join('');
}

/** Runs of letters (code-point indices): `"Jack-o'-lantern"` → jack, o, lantern. */
function letterWords(word: string): number[][] {
  const words: number[][] = [];
  let current: number[] = [];
  [...word].forEach((ch, i) => {
    if (LETTER.test(ch)) current.push(i);
    else if (current.length > 0) {
      words.push(current);
      current = [];
    }
  });
  if (current.length > 0) words.push(current);
  return words;
}

/** Each word shows at most a third of its letters, so words under 3 letters show none. */
function wordCap(letters: number): number {
  return Math.floor(letters / 3);
}

/**
 * One hint per 5 letters (rounded up), and never more than a third of any word: "Moon" 1,
 * "Pumpkin" 2, "Headless horseman" 4, "Vampire on a unicycle" 4.
 */
export function maxHints(word: string): number {
  const words = letterWords(word);
  const letters = words.reduce((n, w) => n + w.length, 0);
  const capped = words.reduce((n, w) => n + wordCap(w.length), 0);
  return Math.min(capped, Math.ceil(letters / 5));
}

/**
 * When hint `k` (0-based) of `total` shows, as a share of the draw time: evenly from ½ to ⅘.
 * A single hint shows at ½.
 */
export function hintFraction(k: number, total: number): number {
  return total <= 1 ? 0.5 : 0.5 + (0.3 * k) / (total - 1);
}

/**
 * The next hidden letter to reveal, or `null` if the hint budget is used up. Hints go round the
 * words, the least-revealed first, so a phrase gets a letter in each word before a second in any.
 * A word's first letter goes last: it gives the most away.
 */
export function pickHintIndex(
  word: string,
  revealed: ReadonlySet<number>,
  rng: Rng,
): number | null {
  if (revealed.size >= maxHints(word)) return null;
  const open = letterWords(word)
    .map((w) => ({ w, shown: w.filter((i) => revealed.has(i)).length, cap: wordCap(w.length) }))
    .filter(({ shown, cap }) => shown < cap);
  if (open.length === 0) return null;
  const least = Math.min(...open.map(({ shown, cap }) => shown / cap));
  const candidates = open.filter(({ shown, cap }) => shown / cap === least);
  const pick = candidates[randomInt(rng, candidates.length)];
  if (!pick) return null;
  const hidden = pick.w.filter((i) => !revealed.has(i));
  const notFirst = hidden.filter((i) => i !== pick.w[0]);
  const pool = notFirst.length > 0 ? notFirst : hidden;
  return pool[randomInt(rng, pool.length)] ?? null;
}
