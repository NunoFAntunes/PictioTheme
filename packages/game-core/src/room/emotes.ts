import {
  EMOTE_GAP_MS,
  EMOTE_REFILL_MS,
  isTargetedEmote,
  type Emote,
  type EmoteCharges,
  type PlayerId,
} from '@pictiotheme/protocol';
import { emoteCharges } from './emote-charges';
import { send, sendError, sendToAll } from './output';
import type { Ctx } from './types';

/**
 * Emotes (game-rules.md#emotes): animated actions on your own character (dance, taunt…) or aimed
 * at another player (squish, slap…). Any phase, no effect on the game. Each player has
 * `EMOTE_CHARGES` charges that come back one every `EMOTE_REFILL_MS`, and must wait `EMOTE_GAP_MS`
 * between two emotes.
 */

export function onEmote(c: Ctx, playerId: PlayerId, emote: Emote, target?: PlayerId): void {
  const { state, now } = c;
  if (isTargetedEmote(emote)) {
    if (target === undefined || target === playerId || !state.players.get(target)?.connected) {
      sendError(c, playerId, 'VALIDATION', 'Pick another player for that one');
      return;
    }
  } else if (target !== undefined && target !== playerId) {
    sendError(c, playerId, 'VALIDATION', 'That one is only for yourself');
    return;
  }

  const charges = emoteCharges(state, playerId, now);
  if (charges.left === 0 || now < charges.readyAt) {
    sendError(c, playerId, 'RATE_LIMITED', 'Easy there! Your emotes are recharging');
    return;
  }
  const after: EmoteCharges = {
    left: charges.left - 1,
    // The refill clock starts when the first charge is used, and keeps its pace after that.
    refillAt: charges.refillAt ?? now + EMOTE_REFILL_MS,
    readyAt: now + EMOTE_GAP_MS,
  };
  state.emoteCharges.set(playerId, after);

  sendToAll(c, {
    t: 'emote',
    playerId,
    emote,
    ...(isTargetedEmote(emote) && target !== undefined && { target }),
  });
  send(c, playerId, { t: 'emote:charges', charges: after });
}
