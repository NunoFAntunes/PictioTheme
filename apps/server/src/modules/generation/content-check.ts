import { hasProfanity, tokenize } from '@pictiotheme/game-core';
import type { DeckGenerationRequest } from '@pictiotheme/protocol';
import { AppError } from '../../lib/errors';

/**
 * The generation blocklist (ai-deck-pipeline.md#theme-pre-check and #validation-and-cleanup):
 * profanity and slurs, plus themes that don't belong in a party game for all ages. A cheap
 * synchronous check; an LLM classification call can be added later for subtler cases.
 */

/** Matched as whole words or phrases, after normalization (lowercase, singular, no accents). */
const BLOCKED_TERMS = [
  'nazi',
  'hitler',
  'kkk',
  'isis',
  'porn',
  'porno',
  'hentai',
  'nsfw',
  'rape',
  'rapist',
  'incest',
  'pedophile',
  'paedophile',
  'genocide',
  'suicide',
  'self harm',
  'school shooting',
  'terrorist',
  'terrorism',
];

/** True if the text has profanity, a slur, or a blocked theme. */
export function isBlockedText(text: string): boolean {
  if (hasProfanity(text)) return true;
  const words = ` ${tokenize(text).join(' ')} `;
  return BLOCKED_TERMS.some((term) => words.includes(` ${term} `));
}

/** The theme pre-check: before a job starts, so a blocked theme never costs a model call. */
export function assertAllowedRequest(
  request: Pick<DeckGenerationRequest, 'theme' | 'notes'>,
): void {
  if (isBlockedText(request.theme) || isBlockedText(request.notes)) {
    throw new AppError(
      'VALIDATION',
      400,
      "We can't make a deck about that. Try a different theme.",
    );
  }
}
