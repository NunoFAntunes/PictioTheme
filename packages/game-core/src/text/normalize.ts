import pluralize from 'pluralize';

/**
 * English normalization used by guess matching, deck dedupe and the profanity filter.
 * Steps follow docs/technical/guess-matching.md §1.
 */

const LEADING_ARTICLES = new Set(['a', 'an', 'the']);

/** Words ignored when comparing "meaningful" words (keyword coverage, token overlap). */
const FILLER_WORDS = new Set(['a', 'an', 'the', 'on', 'in', 'at', 'of', 'with', 'doing', 'is']);

/** Short words are left alone: singularizing them causes more harm ("bus", "gas", "its") than good. */
const MIN_SINGULARIZE_LENGTH = 4;

function cleanup(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // strip diacritics: séance → seance
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]s\b/g, '') // possessive: witch's → witch
    .replace(/['’]/g, '') // other apostrophes: don't → dont
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // punctuation and hyphens become spaces
    .trim();
}

function singularize(word: string): string {
  return word.length >= MIN_SINGULARIZE_LENGTH ? pluralize.singular(word) : word;
}

/** Normalized words, singularized, with a leading article dropped ("a pumpkin" → ["pumpkin"]). */
export function tokenize(input: string): string[] {
  const cleaned = cleanup(input);
  if (cleaned === '') return [];
  const words = cleaned.split(' ').map(singularize);
  if (words.length > 1 && LEADING_ARTICLES.has(words[0] as string)) words.shift();
  return words;
}

export function normalizeText(input: string): string {
  return tokenize(input).join(' ');
}

export function meaningfulWords(tokens: readonly string[]): string[] {
  return tokens.filter((t) => !FILLER_WORDS.has(t));
}
