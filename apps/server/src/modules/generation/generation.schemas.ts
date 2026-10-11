import { Difficulty } from '@pictiotheme/protocol';
import { z } from 'zod';
import { LlmThemeCheck } from './theme-check';
import { LlmTranslationOutput } from './translate-prompt';

/**
 * What the model is asked to return. Deliberately looser than `GeneratedDeck` in protocol:
 * structured-output support for length limits varies by model, and one bad card should be
 * dropped by cleanup (clean-deck.ts), not fail the whole deck.
 */
export const LlmDeckOutput = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  cards: z.array(
    z.object({
      text: z.string(),
      difficulty: Difficulty,
      alternates: z.array(z.string()),
      keywords: z.array(z.string()),
    }),
  ),
});
export type LlmDeckOutput = z.infer<typeof LlmDeckOutput>;

/** A top-up reply only adds cards. */
export const LlmTopUpOutput = LlmDeckOutput.pick({ cards: true });

/**
 * Chaos cards (chaos-prompt.ts). `subject`, `hook` and `twist` come before `text` so the model
 * reasons about the joke before writing the card; cleanup uses `subject` and `twist` to enforce
 * variety (clean-deck.ts `cleanChaosCards`), and none of them are saved.
 */
export const LlmChaosOutput = z.object({
  cards: z.array(
    z.object({
      subject: z.string(),
      hook: z.string(),
      twist: z.string(),
      text: z.string(),
      alternates: z.array(z.string()),
      keywords: z.array(z.string()),
    }),
  ),
});
export type LlmChaosCard = z.infer<typeof LlmChaosOutput>['cards'][number];

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { target: 'draft-7' });
  return rest;
}

export const DECK_JSON_SCHEMA = { name: 'deck', schema: jsonSchemaOf(LlmDeckOutput) };
export const TOP_UP_JSON_SCHEMA = { name: 'deck_cards', schema: jsonSchemaOf(LlmTopUpOutput) };
export const CHAOS_JSON_SCHEMA = { name: 'chaos_cards', schema: jsonSchemaOf(LlmChaosOutput) };
export const THEME_CHECK_JSON_SCHEMA = { name: 'theme_check', schema: jsonSchemaOf(LlmThemeCheck) };
export const TRANSLATION_JSON_SCHEMA = {
  name: 'deck_translation',
  schema: jsonSchemaOf(LlmTranslationOutput),
};
