import type { RoomSettings } from '@pictiotheme/protocol';

/**
 * The house rules' one "Cards" choice, folding the mode and the difficulties together: those
 * only make four different matches (game-rules.md#card-pool), so the host picks one of them.
 */
export const CARD_POOLS = [
  { id: 'easy', label: 'Easy', hint: 'Only the deck’s easy cards' },
  { id: 'mixed', label: 'Mixed', hint: 'The deck’s easy and hard cards' },
  { id: 'hard', label: 'Hard', hint: 'Only the deck’s hard cards' },
  { id: 'chaos', label: '🌀 Chaos', hint: 'Only the absurd cards' },
] as const;

export type CardPoolId = (typeof CARD_POOLS)[number]['id'];

export function cardPoolOf(settings: Pick<RoomSettings, 'mode' | 'difficulties'>): CardPoolId {
  if (settings.mode === 'chaos') return 'chaos';
  if (settings.difficulties.length === 2) return 'mixed';
  return settings.difficulties[0] === 'hard' ? 'hard' : 'easy';
}

/** The settings that play `pool`. Chaos keeps the difficulties, for coming back to Normal. */
export function cardPoolSettings(
  pool: CardPoolId,
): Partial<Pick<RoomSettings, 'mode' | 'difficulties'>> {
  switch (pool) {
    case 'chaos':
      return { mode: 'chaos' };
    case 'mixed':
      return { mode: 'normal', difficulties: ['easy', 'hard'] };
    default:
      return { mode: 'normal', difficulties: [pool] };
  }
}
