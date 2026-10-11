import { CHAOS_MIN_CARDS, type RoomDeck } from '@pictiotheme/protocol';

/** Whether the room's deck can play a Chaos match (game-rules.md#card-pool). */
export function hasChaosCards(deck: RoomDeck | null): boolean {
  return deck !== null && deck.chaosCards >= CHAOS_MIN_CARDS;
}
