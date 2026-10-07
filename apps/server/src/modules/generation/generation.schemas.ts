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
      silly: z.boolean(),
      alternates: z.array(z.string()),
      keywords: z.array(z.string()),
    }),
  ),
});
export type LlmDeckOutput = z.infer<typeof LlmDeckOutput>;
export type LlmCard = LlmDeckOutput['cards'][number];

/** A top-up reply only adds cards. */
export const LlmTopUpOutput = LlmDeckOutput.pick({ cards: true });

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { target: 'draft-7' });
  return rest;
}

export const DECK_JSON_SCHEMA = { name: 'deck', schema: jsonSchemaOf(LlmDeckOutput) };
export const TOP_UP_JSON_SCHEMA = { name: 'deck_cards', schema: jsonSchemaOf(LlmTopUpOutput) };
export const THEME_CHECK_JSON_SCHEMA = { name: 'theme_check', schema: jsonSchemaOf(LlmThemeCheck) };
export const TRANSLATION_JSON_SCHEMA = {
  name: 'deck_translation',
  schema: jsonSchemaOf(LlmTranslationOutput),
};
