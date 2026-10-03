import { z } from 'zod';

export const Difficulty = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof Difficulty>;

export const CARD_TEXT_MIN = 2;
export const CARD_TEXT_MAX = 40;

/** One thing to draw. See docs/product/decks.md. */
export const Card = z.object({
  text: z.string().min(CARD_TEXT_MIN).max(CARD_TEXT_MAX),
  difficulty: Difficulty,
  silly: z.boolean(),
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
