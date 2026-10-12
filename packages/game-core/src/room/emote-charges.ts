import {
  EMOTE_CHARGES,
  emoteChargesAt,
  type EmoteCharges,
  type PlayerId,
} from '@pictiotheme/protocol';
import type { RoomState } from './types';

/** A player's charges at `now`, with the ones that came back since they were last used. */
export function emoteCharges(state: RoomState, playerId: PlayerId, now: number): EmoteCharges {
  const stored = state.emoteCharges.get(playerId);
  return stored ? emoteChargesAt(stored, now) : { left: EMOTE_CHARGES, refillAt: null, readyAt: 0 };
}
