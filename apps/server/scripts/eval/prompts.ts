import { CHAOS_PROMPT, SYSTEM_PROMPT } from '../../src/modules/generation';

/**
 * Prompt variants compared by the eval: `PROMPTS` for a deck's easy and hard cards,
 * `CHAOS_PROMPTS` for its Chaos cards. `current` is production. Add a variant here to test a
 * change against it (`--prompts current,my-variant`). The 2026-10 eval's v1-v3 deck prompts
 * (docs/technical/model-eval-2026-10.md) were retired with the silly cards and medium.
 * Every variant must keep its prompt's output section, so models without structured-output
 * support get the JSON shape either way.
 */

export const PROMPTS: Record<string, string> = {
  current: SYSTEM_PROMPT,
};

export const CHAOS_PROMPTS: Record<string, string> = {
  current: CHAOS_PROMPT,
};
