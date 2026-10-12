import { z } from 'zod';

/**
 * Emotes (game-rules.md#emotes): a player clicks a character in the margin and picks an animated
 * action. On your own character they're solo (`SOLO_EMOTES`), on someone else's they're aimed at
 * them (`TARGETED_EMOTES`). They change nothing in the game: everyone sees the animation and a line
 * in the feed.
 */
export const SOLO_EMOTES = ['dance', 'taunt', 'flex', 'cry'] as const;
export const TARGETED_EMOTES = ['squish', 'slap', 'tomato', 'hug'] as const;

export const Emote = z.enum([...SOLO_EMOTES, ...TARGETED_EMOTES]);
export type Emote = z.infer<typeof Emote>;
export type SoloEmote = (typeof SOLO_EMOTES)[number];
export type TargetedEmote = (typeof TARGETED_EMOTES)[number];

export function isTargetedEmote(emote: Emote): emote is TargetedEmote {
  return (TARGETED_EMOTES as readonly Emote[]).includes(emote);
}

/**
 * Against spam, each player has a few charges: an emote uses one, and they come back one at a time.
 * There's also a short gap between two emotes, so the animations don't pile up.
 */
export const EMOTE_CHARGES = 3;
export const EMOTE_REFILL_MS = 20_000;
export const EMOTE_GAP_MS = 2_500;

/** A player's own emote charges: how many are left, and when the next one comes back (if any). */
export const EmoteCharges = z.object({
  left: z.number().int().min(0),
  refillAt: z.number().nullable(),
  /** No emote before this (the gap after the last one). */
  readyAt: z.number(),
});
export type EmoteCharges = z.infer<typeof EmoteCharges>;

/**
 * Charges as of `now`: `charges` plus the ones that came back since (one every `EMOTE_REFILL_MS`,
 * up to `EMOTE_CHARGES`). The server stores them as of the last emote; clients count down with it.
 */
export function emoteChargesAt(charges: EmoteCharges, now: number): EmoteCharges {
  let { left, refillAt } = charges;
  while (refillAt !== null && refillAt <= now) {
    left += 1;
    refillAt = left < EMOTE_CHARGES ? refillAt + EMOTE_REFILL_MS : null;
  }
  return { ...charges, left, refillAt };
}
