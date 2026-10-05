import { TIMINGS } from '@pictiotheme/game-core';
import type { RoomSettings } from '@pictiotheme/protocol';

/**
 * The longest a match can take with these settings: everyone draws once a round, and each turn
 * runs to the end of its clock (the cards to choose from, the drawing, the reveal). Turns end
 * early once everyone has guessed, so real matches are usually shorter.
 */
export function maxMatchMinutes(
  settings: Pick<RoomSettings, 'rounds' | 'drawSeconds' | 'wordChoice'>,
  players: number,
): number {
  const turnMs =
    (settings.wordChoice === 1 ? 0 : TIMINGS.chooseMs) +
    settings.drawSeconds * 1_000 +
    TIMINGS.revealMs;
  const turns = settings.rounds * Math.max(2, players);
  return Math.max(1, Math.round((turns * turnMs) / 60_000));
}

/** One-click pace presets for rounds and draw time. */
export const PACES = [
  { id: 'quick', label: '⚡ Quick', rounds: 2, drawSeconds: 60 },
  { id: 'classic', label: '🎲 Classic', rounds: 3, drawSeconds: 80 },
  { id: 'long', label: '🐢 Long', rounds: 5, drawSeconds: 120 },
] as const;

export type PaceId = (typeof PACES)[number]['id'];

/** The preset these settings match, or null when the host tuned them by hand. */
export function paceOf(settings: Pick<RoomSettings, 'rounds' | 'drawSeconds'>): PaceId | null {
  return (
    PACES.find((p) => p.rounds === settings.rounds && p.drawSeconds === settings.drawSeconds)?.id ??
    null
  );
}
