import { z } from 'zod';
import { DEFAULT_DECK_LANGUAGE, DeckLanguage } from './language';

/** Normal mode's two levels. The host picks one or both (game-rules.md#card-pool). */
export const Difficulty = z.enum(['easy', 'hard']);
export type Difficulty = z.infer<typeof Difficulty>;

/**
 * Which pool a card belongs to: a normal-mode difficulty, or Chaos (the absurd cards Chaos mode
 * plays with, docs/product/decks.md#chaos-cards). Chaos cards have no difficulty.
 */
export const CardKind = z.enum(['easy', 'hard', 'chaos']);
export type CardKind = z.infer<typeof CardKind>;

/** A Chaos match needs at least this many chaos cards in the deck. */
export const CHAOS_MIN_CARDS = 10;

export const CARD_TEXT_MIN = 2;
export const CARD_TEXT_MAX = 40;

/** One thing to draw. See docs/product/decks.md. */
export const Card = z.object({
  text: z.string().min(CARD_TEXT_MIN).max(CARD_TEXT_MAX),
  kind: CardKind,
  alternates: z.array(z.string().min(1).max(60)).max(6),
  keywords: z.array(z.string().min(1).max(30)).min(1).max(4),
});
export type Card = z.infer<typeof Card>;

/** The shape an LLM must return when generating a deck. See docs/technical/ai-deck-pipeline.md. */
export const GeneratedDeck = z.object({
  title: z.string().min(2).max(60),
  description: z.string().max(200),
  tags: z.array(z.string().min(1).max(30)).min(1).max(10),
  cards: z.array(Card).min(1).max(250),
});
export type GeneratedDeck = z.infer<typeof GeneratedDeck>;

export const DECK_THEME_MIN = 2;
export const DECK_THEME_MAX = 60;
export const DECK_NOTES_MAX = 300;

/** What a creator asks for when generating a deck with AI. See docs/technical/ai-deck-pipeline.md. */
export const DeckGenerationRequest = z.object({
  theme: z.string().trim().min(DECK_THEME_MIN).max(DECK_THEME_MAX),
  /** Free-text hints for the model ("for kids aged 6+"). Treated as a description, never as instructions. */
  notes: z.string().trim().max(DECK_NOTES_MAX).default(''),
  /**
   * Whether to make the Chaos cards too. Every deck gets easy and hard cards; Chaos cards can
   * also be added later (`POST /api/decks/:id/chaos`).
   */
  chaos: z.boolean(),
  /**
   * What the deck is written in: the room's language. A rule for the model, and the theme and
   * notes must be written in it too (ai-deck-pipeline.md#theme-check).
   */
  language: DeckLanguage.default(DEFAULT_DECK_LANGUAGE),
});
export type DeckGenerationRequest = z.infer<typeof DeckGenerationRequest>;

/**
 * Deck back covers, drawn by the deck's creator while the deck generates (docs/product/decks.md).
 * Sent as a PNG data URL; the server stores it content-addressed and serves it by id
 * (`GET /api/decks/covers/:id`). A deck without one shows a default cover made from its title.
 */
export const DECK_COVER_WIDTH_PX = 300;
export const DECK_COVER_HEIGHT_PX = 400;
export const DECK_COVER_MAX_BYTES = 150_000;
const COVER_DATA_URL_PREFIX = 'data:image/png;base64,';
export const DeckCoverImage = z
  .string()
  .startsWith(COVER_DATA_URL_PREFIX)
  .max(COVER_DATA_URL_PREFIX.length + Math.ceil(DECK_COVER_MAX_BYTES / 3) * 4);
export type DeckCoverImage = z.infer<typeof DeckCoverImage>;

export const DeckCoverId = z.string().regex(/^[0-9a-f]{32}$/);
export type DeckCoverId = z.infer<typeof DeckCoverId>;
