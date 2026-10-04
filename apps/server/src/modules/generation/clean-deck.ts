import { meaningfulWords, normalizeText, tokenize } from '@pictiotheme/game-core';
import {
  CARD_TEXT_MAX,
  CARD_TEXT_MIN,
  GeneratedDeck,
  type Card,
  type DeckGenerationRequest,
} from '@pictiotheme/protocol';
import { isBlockedText } from './content-check';
import { targetCounts, type Bucket } from './deck-prompt';
import type { LlmCard, LlmDeckOutput } from './generation.schemas';

/**
 * Deterministic cleanup of model output, after the model call.
 * Checks follow docs/technical/ai-deck-pipeline.md#validation-and-cleanup-deterministic-after-the-model-call.
 */

/** A pool below this share of its target triggers a top-up call (and fails the job after one). */
export const MIN_TARGET_SHARE = 0.7;

const MAX_ALTERNATE_LENGTH = 60;
const MAX_ALTERNATES = 6;
const MAX_KEYWORD_LENGTH = 30;
const MAX_KEYWORDS = 4;
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_TAG_LENGTH = 30;
const MAX_TAGS = 10;

/** Letters (accents included), spaces, hyphens and apostrophes. No digits, emoji or punctuation. */
const ALLOWED_TEXT = /^\p{L}[\p{L}\p{M} '’-]*$/u;

export type DropReason =
  'wrongPool' | 'length' | 'characters' | 'blocked' | 'duplicate' | 'noKeywords';
export type DropCounts = Record<DropReason, number>;

export function emptyDropCounts(): DropCounts {
  return { wrongPool: 0, length: 0, characters: 0, blocked: 0, duplicate: 0, noKeywords: 0 };
}

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Same words in any order count as one card ("Vampire on a unicycle" / "Unicycle vampire"). */
function duplicateKey(text: string): string {
  return [...meaningfulWords(tokenize(text))].sort().join(' ');
}

export function bucketOf(card: Pick<Card, 'difficulty' | 'silly'>): Bucket {
  return card.silly ? 'silly' : card.difficulty;
}

function cleanAlternates(text: string, alternates: readonly string[]): string[] {
  const seen = new Set([normalizeText(text)]);
  const kept: string[] = [];
  for (const raw of alternates) {
    const alt = tidy(raw);
    const key = normalizeText(alt);
    if (alt.length > MAX_ALTERNATE_LENGTH || !ALLOWED_TEXT.test(alt) || key === '') continue;
    if (isBlockedText(alt)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(alt);
    if (kept.length === MAX_ALTERNATES) break;
  }
  return kept;
}

/**
 * Keeps keywords whose words all appear in the text or an alternate, so a correct guess can
 * contain them. Falls back to the text's meaningful words, like the built-in decks.
 */
function cleanKeywords(text: string, alternates: readonly string[], keywords: readonly string[]) {
  const available = new Set([text, ...alternates].flatMap((t) => tokenize(t)));
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of keywords) {
    const keyword = tidy(raw).toLowerCase();
    const tokens = tokenize(keyword);
    const key = tokens.join(' ');
    if (keyword.length > MAX_KEYWORD_LENGTH || tokens.length === 0 || seen.has(key)) continue;
    if (!tokens.every((t) => available.has(t))) continue;
    seen.add(key);
    kept.push(keyword);
    if (kept.length === MAX_KEYWORDS) break;
  }
  return kept.length > 0 ? kept : meaningfulWords(tokenize(text)).slice(0, MAX_KEYWORDS);
}

/**
 * Cleans cards from the model. Cards that duplicate each other or `existing` (the deck so far,
 * for a top-up) are dropped, as are cards outside the requested pools.
 */
export function cleanCards(
  raw: readonly LlmCard[],
  request: DeckGenerationRequest,
  existing: readonly Card[] = [],
): { cards: Card[]; dropped: DropCounts } {
  const allowed = new Set(request.difficulties);
  const seen = new Set(existing.map((c) => duplicateKey(c.text)));
  const dropped = emptyDropCounts();
  const cards: Card[] = [];

  for (const card of raw) {
    const text = tidy(card.text);
    if (!allowed.has(card.difficulty) || (card.silly && !request.silly)) {
      dropped.wrongPool++;
      continue;
    }
    if (text.length < CARD_TEXT_MIN || text.length > CARD_TEXT_MAX) {
      dropped.length++;
      continue;
    }
    if (!ALLOWED_TEXT.test(text)) {
      dropped.characters++;
      continue;
    }
    if (isBlockedText(text)) {
      dropped.blocked++;
      continue;
    }
    const key = duplicateKey(text);
    if (key === '' || seen.has(key)) {
      dropped.duplicate++;
      continue;
    }
    const alternates = cleanAlternates(text, card.alternates);
    const keywords = cleanKeywords(text, alternates, card.keywords);
    if (keywords.length === 0) {
      dropped.noKeywords++;
      continue;
    }
    seen.add(key);
    cards.push({ text, difficulty: card.difficulty, silly: card.silly, alternates, keywords });
  }
  return { cards, dropped };
}

/** How many cards each pool still needs to reach its target, for pools below `MIN_TARGET_SHARE`. */
export function missingCounts(
  request: DeckGenerationRequest,
  cards: readonly Card[],
): Map<Bucket, number> {
  const have = new Map<Bucket, number>();
  for (const card of cards) have.set(bucketOf(card), (have.get(bucketOf(card)) ?? 0) + 1);

  const missing = new Map<Bucket, number>();
  for (const [bucket, target] of targetCounts(request)) {
    const count = have.get(bucket) ?? 0;
    if (count < Math.ceil(target * MIN_TARGET_SHARE)) missing.set(bucket, target - count);
  }
  return missing;
}

function cleanTags(tags: readonly string[], theme: string): string[] {
  const kept = [
    ...new Set(tags.map((t) => tidy(t).toLowerCase()).filter((t) => t.length > 0)),
  ].filter((t) => t.length <= MAX_TAG_LENGTH);
  return kept.length > 0 ? kept.slice(0, MAX_TAGS) : [theme.toLowerCase().slice(0, MAX_TAG_LENGTH)];
}

/**
 * True when the deck's title, description or a tag hits the blocklist. The theme passed the
 * pre-check, so this means the model went off the rails: the whole job fails.
 */
export function hasBlockedMeta(
  meta: Pick<LlmDeckOutput, 'title' | 'description' | 'tags'>,
): boolean {
  return [meta.title, meta.description, ...meta.tags].some((text) => isBlockedText(text));
}

/** Assembles the final deck and validates it against the shared schema (rule B25). */
export function buildDeck(
  meta: Pick<LlmDeckOutput, 'title' | 'description' | 'tags'>,
  cards: readonly Card[],
  request: DeckGenerationRequest,
): GeneratedDeck {
  const title = tidy(meta.title);
  return GeneratedDeck.parse({
    title: title.length >= 2 && title.length <= MAX_TITLE_LENGTH ? title : request.theme,
    description: tidy(meta.description).slice(0, MAX_DESCRIPTION_LENGTH).trim(),
    tags: cleanTags(meta.tags, request.theme),
    cards,
  });
}
