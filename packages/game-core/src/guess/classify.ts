import type { Card, GuessKind } from '@pictiotheme/protocol';
import { editDistance } from '../text/distance';
import { meaningfulWords, tokenize } from '../text/normalize';

/**
 * Correct / close / wrong classification. Spec and test table: docs/technical/guess-matching.md.
 * Runs on every guess, so a card is prepared once per turn with `prepareCard`.
 */

/**
 * A guess that contains the answer plus a few extra words still counts ("is it pumpkin" → correct).
 * The cap stops shotgun guesses like "cat dog bird fish horse cow" from always winning.
 */
const MAX_EXTRA_WORDS = 3;

/** Keywords this short must match exactly: one edit away is a different word ("cat" / "car"). */
const MIN_FUZZY_KEYWORD_LENGTH = 4;

type Target = {
  tokens: string[];
  joined: string;
  /** Without spaces, for edit distance ("witchhat"). */
  compact: string;
  meaningful: string[];
};

export type PreparedCard = {
  silly: boolean;
  targets: Target[];
  keywords: string[][];
};

export function prepareCard(card: Pick<Card, 'text' | 'alternates' | 'keywords' | 'silly'>) {
  const targets = [card.text, ...card.alternates]
    .map((t) => tokenize(t))
    .filter((tokens) => tokens.length > 0)
    .map((tokens): Target => ({
      tokens,
      joined: tokens.join(' '),
      compact: tokens.join(''),
      meaningful: meaningfulWords(tokens),
    }));
  const keywords = card.keywords.map((k) => tokenize(k)).filter((k) => k.length > 0);
  return { silly: card.silly, targets, keywords } satisfies PreparedCard;
}

/** Max edits for a guess to count as close, by target length (letters only). */
function closeThreshold(targetLength: number): number {
  if (targetLength <= 4) return 1;
  if (targetLength <= 8) return 2;
  return 3;
}

function containsSequence(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function wordMatches(guessWord: string, word: string): boolean {
  if (guessWord === word) return true;
  return word.length >= MIN_FUZZY_KEYWORD_LENGTH && editDistance(guessWord, word) <= 1;
}

/** Share of the card's keywords found in the guess (any order, one typo allowed on longer words). */
function keywordCoverage(card: PreparedCard, guess: readonly string[]): number {
  if (card.keywords.length === 0) return 0;
  const found = card.keywords.filter((kw) =>
    kw.length === 1
      ? guess.some((g) => wordMatches(g, kw[0] as string))
      : containsSequence(guess, kw),
  ).length;
  return found / card.keywords.length;
}

/** Share of the target's meaningful words that appear in the guess. */
function wordOverlap(target: Target, guess: readonly string[]): number {
  if (target.meaningful.length === 0) return 0;
  const guessWords = new Set(guess);
  return target.meaningful.filter((w) => guessWords.has(w)).length / target.meaningful.length;
}

export function classifyGuess(card: PreparedCard, rawGuess: string): GuessKind {
  const guess = tokenize(rawGuess);
  if (guess.length === 0) return 'wrong';
  const joined = guess.join(' ');
  const compact = guess.join('');

  // ── Correct ──
  for (const t of card.targets) {
    if (joined === t.joined) return 'correct';
    if (guess.length - t.tokens.length <= MAX_EXTRA_WORDS && containsSequence(guess, t.tokens)) {
      return 'correct';
    }
  }
  if (card.silly) {
    // Silly cards are matched by concepts, in any order: "unicycle vampire".
    const guessWords = new Set(guess);
    const allWordsOfSomeTarget = card.targets.some(
      (t) => t.meaningful.length > 0 && t.meaningful.every((w) => guessWords.has(w)),
    );
    if (allWordsOfSomeTarget || keywordCoverage(card, guess) === 1) return 'correct';
  }

  // ── Close ──
  for (const t of card.targets) {
    if (editDistance(compact, t.compact) <= closeThreshold(t.compact.length)) return 'close';
    if (t.meaningful.length > 1 && wordOverlap(t, guess) >= 0.5) return 'close';
  }
  if (card.silly && keywordCoverage(card, guess) >= 0.5) return 'close';
  for (const t of card.targets) {
    if (t.tokens.length < 2) continue;
    const nearWord = t.tokens.some(
      (w) => w.length >= MIN_FUZZY_KEYWORD_LENGTH && guess.some((g) => editDistance(g, w) <= 1),
    );
    if (nearWord) return 'close';
  }

  return 'wrong';
}
