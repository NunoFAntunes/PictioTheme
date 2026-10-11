import {
  isInLanguageScript,
  meaningfulWords,
  normalizeText,
  tokenize,
} from '@pictiotheme/game-core';
import {
  CARD_TEXT_MAX,
  CARD_TEXT_MIN,
  GeneratedDeck,
  type Card,
  type CardKind,
  type DeckLanguage,
  type Difficulty,
} from '@pictiotheme/protocol';
import { CHAOS_TARGET } from './chaos-prompt';
import { isBlockedText } from './content-check';
import { targetCounts } from './deck-prompt';
import type { LlmChaosCard, LlmDeckOutput } from './generation.schemas';

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
  | 'wrongPool'
  | 'length'
  | 'characters'
  | 'language'
  | 'blocked'
  | 'duplicate'
  | 'noKeywords'
  /** A hard card that is an easy card with a label stuck on ("Cassiopeia snake queen"). */
  | 'label'
  /** Chaos: the model couldn't say which trait of the subject the joke plays on. */
  | 'noHook'
  /** Chaos: the deck already has this twist ("walking a dog" once per deck). */
  | 'repeatedTwist'
  /** Chaos: the subject already has `MAX_CARDS_PER_SUBJECT` cards. */
  | 'busySubject'
  /** Chaos: past the deck's `MAX_STOCK_TWISTS` stock activities. */
  | 'stockTwist';
export type DropCounts = Record<DropReason, number>;

export function emptyDropCounts(): DropCounts {
  return {
    wrongPool: 0,
    length: 0,
    characters: 0,
    language: 0,
    blocked: 0,
    duplicate: 0,
    noKeywords: 0,
    label: 0,
    noHook: 0,
    repeatedTwist: 0,
    busySubject: 0,
    stockTwist: 0,
  };
}

export function addDropCounts(into: DropCounts, more: DropCounts): void {
  for (const [reason, n] of Object.entries(more)) into[reason as DropReason] += n;
}

/** A card as cleanup sees it: the model's fields, with its kind decided by the caller. */
export type RawCard = {
  text: string;
  kind: CardKind;
  alternates: readonly string[];
  keywords: readonly string[];
};

/** What cleanup checks cards against: the kinds asked for and the deck's language. */
export type CardRules = { kinds: readonly CardKind[]; language: DeckLanguage };

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Same words in any order count as one card ("Vampire on a unicycle" / "Unicycle vampire"). */
function duplicateKey(text: string): string {
  return [...meaningfulWords(tokenize(text))].sort().join(' ');
}

/** Words that make "Name + words" a scene rather than a label: "Pig IN a mud bath". */
const SCENE_WORDS = new Set([
  'in',
  'on',
  'at',
  'with',
  'of',
  'from',
  'into',
  'onto',
  'under',
  'over',
  'and',
  'to',
  'by',
  'for',
  'through',
  'near',
  'inside',
  'behind',
  'a',
  'an',
  'the',
  'its',
  'his',
  'her',
  'their',
]);

function startsOrEndsWith(tokens: readonly string[], part: readonly string[]): string[] | null {
  if (part.length === 0 || part.length >= tokens.length) return null;
  const head = tokens.slice(0, part.length).join(' ') === part.join(' ');
  if (head) return tokens.slice(part.length);
  const tail = tokens.slice(-part.length).join(' ') === part.join(' ');
  return tail ? tokens.slice(0, -part.length) : null;
}

/**
 * True for a hard card that's one of the deck's easy cards with a label stuck on: the name plus
 * words with no action or relation in them ("Cassiopeia snake queen", "Muddy pig"). English only:
 * the "-ing" and preposition test doesn't carry over to other languages, which rely on the prompt.
 */
export function isLabelledName(
  text: string,
  easyCards: readonly (readonly string[])[],
  language: DeckLanguage,
): boolean {
  if (language !== 'en') return false;
  const tokens = tokenize(text);
  return easyCards.some((easy) => {
    const rest = startsOrEndsWith(tokens, easy);
    if (!rest) return false;
    return !rest.some((w) => SCENE_WORDS.has(w) || (w.length > 4 && w.endsWith('ing')));
  });
}

function cleanAlternates(
  text: string,
  alternates: readonly string[],
  language: CardRules['language'],
): string[] {
  const seen = new Set([normalizeText(text)]);
  const kept: string[] = [];
  for (const raw of alternates) {
    const alt = tidy(raw);
    const key = normalizeText(alt);
    if (alt.length > MAX_ALTERNATE_LENGTH || !ALLOWED_TEXT.test(alt) || key === '') continue;
    // A Latin-letter alternate is fine in any language: players type "Pikachu" in Tokyo too.
    if (!isInLanguageScript(alt, language) && !isInLanguageScript(alt, 'en')) continue;
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
 * for a top-up) are dropped, as are cards of kinds not asked for, cards not written in the deck
 * language's script (the language rule's deterministic half), and hard cards that are an easy
 * card with a label stuck on.
 */
export function cleanCards(
  raw: readonly RawCard[],
  rules: CardRules,
  existing: readonly Card[] = [],
): { cards: Card[]; dropped: DropCounts } {
  const allowed = new Set(rules.kinds);
  const seen = new Set(existing.map((c) => duplicateKey(c.text)));
  const easyCards = [...existing, ...raw]
    .filter((c) => c.kind === 'easy')
    .map((c) => tokenize(c.text))
    .filter((t) => t.length > 0);
  const dropped = emptyDropCounts();
  const cards: Card[] = [];

  for (const card of raw) {
    const text = tidy(card.text);
    if (!allowed.has(card.kind)) {
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
    if (!isInLanguageScript(text, rules.language)) {
      dropped.language++;
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
    if (card.kind === 'hard' && isLabelledName(text, easyCards, rules.language)) {
      dropped.label++;
      continue;
    }
    const alternates = cleanAlternates(text, card.alternates, rules.language);
    const keywords = cleanKeywords(text, alternates, card.keywords);
    if (keywords.length === 0) {
      dropped.noKeywords++;
      continue;
    }
    seen.add(key);
    cards.push({ text, kind: card.kind, alternates, keywords });
  }
  return { cards, dropped };
}

/** How many cards each difficulty still needs to reach its target, for those below `MIN_TARGET_SHARE`. */
export function missingCounts(cards: readonly Card[]): Map<Difficulty, number> {
  const missing = new Map<Difficulty, number>();
  for (const [difficulty, target] of targetCounts()) {
    const count = cards.filter((c) => c.kind === difficulty).length;
    if (count < Math.ceil(target * MIN_TARGET_SHARE)) missing.set(difficulty, target - count);
  }
  return missing;
}

/** How many Chaos cards are still needed, or 0 when there are enough (`MIN_TARGET_SHARE`). */
export function missingChaos(cards: readonly Card[]): number {
  const count = cards.filter((c) => c.kind === 'chaos').length;
  return count < Math.ceil(CHAOS_TARGET * MIN_TARGET_SHARE) ? CHAOS_TARGET - count : 0;
}

// ── Chaos variety (ai-deck-pipeline.md#chaos-cards) ──

export const MAX_CARDS_PER_SUBJECT = 3;
export const MAX_STOCK_TWISTS = 3;

/**
 * Stock activities the old prompt leaned on ("walking a dog" was on 25 decks). Matched on the
 * twist only, so a role reversal like "Dog walking its owner" (twist "walking its owner") is fine.
 * Each entry is word prefixes that must all appear. English only.
 */
const STOCK_TWISTS: readonly (readonly string[])[] = [
  ['walk', 'dog'],
  ['paint', 'fence'],
  ['yoga'],
  ['kite'],
  ['mow'],
  ['lawn'],
  ['bicycle'],
  ['bike'],
  ['scooter'],
  ['skateboard'],
  ['unicycle'],
  ['laundry'],
  ['car', 'wash'],
  ['knit'],
  ['juggl'],
  ['lift', 'weight'],
  ['trampoline'],
  ['lemonade'],
  ['surf'],
  ['dish'],
];

function isStockTwist(words: readonly string[]): boolean {
  return STOCK_TWISTS.some((stock) => stock.every((p) => words.some((w) => w.startsWith(p))));
}

/** What a Chaos job has used so far, so a top-up keeps to the same limits. */
export type ChaosVariety = { twists: string[][]; subjects: Map<string, number>; stock: number };

export function emptyVariety(): ChaosVariety {
  return { twists: [], subjects: new Map(), stock: 0 };
}

/**
 * Two twists are one joke when they have the same words, one's words contain the other's
 * ("dog" / "walking a dog"), or they end on the same thing ("making spaghetti" / "eating spaghetti").
 */
function sameTwist(a: readonly string[], b: readonly string[]): boolean {
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  if (small.every((w) => big.includes(w))) return true;
  return a.length > 1 && b.length > 1 && a.at(-1) === b.at(-1);
}

/**
 * Cleans Chaos cards: the variety rules first (a hook, each twist once, at most
 * `MAX_CARDS_PER_SUBJECT` per subject, at most `MAX_STOCK_TWISTS` stock activities), then the
 * same checks as every card. `variety` carries over to a top-up and is updated in place.
 */
export function cleanChaosCards(
  raw: readonly LlmChaosCard[],
  language: DeckLanguage,
  existing: readonly Card[],
  variety: ChaosVariety,
): { cards: Card[]; dropped: DropCounts } {
  const dropped = emptyDropCounts();
  const candidates: { card: RawCard; twist: string[]; subject: string; stock: boolean }[] = [];
  for (const c of raw) {
    if (tidy(c.hook).length < 3) {
      dropped.noHook++;
      continue;
    }
    candidates.push({
      card: { text: c.text, kind: 'chaos', alternates: c.alternates, keywords: c.keywords },
      twist: meaningfulWords(tokenize(c.twist)),
      subject: meaningfulWords(tokenize(c.subject)).join(' '),
      stock: language === 'en' && isStockTwist(meaningfulWords(tokenize(c.twist))),
    });
  }

  const cards: Card[] = [];
  for (const { card, twist, subject, stock } of candidates) {
    if (twist.length > 0 && variety.twists.some((t) => sameTwist(t, twist))) {
      dropped.repeatedTwist++;
      continue;
    }
    if ((variety.subjects.get(subject) ?? 0) >= MAX_CARDS_PER_SUBJECT) {
      dropped.busySubject++;
      continue;
    }
    if (stock && variety.stock >= MAX_STOCK_TWISTS) {
      dropped.stockTwist++;
      continue;
    }
    const cleaned = cleanCards([card], { kinds: ['chaos'], language }, [...existing, ...cards]);
    addDropCounts(dropped, cleaned.dropped);
    const [kept] = cleaned.cards;
    if (!kept) continue;
    cards.push(kept);
    if (twist.length > 0) variety.twists.push(twist);
    variety.subjects.set(subject, (variety.subjects.get(subject) ?? 0) + 1);
    if (stock) variety.stock++;
  }
  return { cards, dropped };
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

/**
 * Assembles the final deck and validates it against the shared schema (rule B25). `fallback`
 * (the theme, or the translated deck's title) stands in for a missing title or tags.
 */
export function buildDeck(
  meta: Pick<LlmDeckOutput, 'title' | 'description' | 'tags'>,
  cards: readonly Card[],
  fallback: string,
): GeneratedDeck {
  const title = tidy(meta.title);
  return GeneratedDeck.parse({
    title: title.length >= 2 && title.length <= MAX_TITLE_LENGTH ? title : fallback,
    description: tidy(meta.description).slice(0, MAX_DESCRIPTION_LENGTH).trim(),
    tags: cleanTags(meta.tags, fallback),
    cards,
  });
}
