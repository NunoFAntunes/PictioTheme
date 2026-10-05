import type { PlayerId } from '@pictiotheme/protocol';
import { send, sendToAll } from './output';
import type { Ctx } from './types';

/**
 * ❤️ likes on drawings (game-rules.md, likes). Players other than the drawer like the current
 * drawing while it's drawn and at its reveal. The room's most-liked drawing becomes its cover on
 * the home page: when a reveal ends with strictly more likes than the cover (a tie keeps the old
 * one), the drawer is asked for a picture, and the shell reports back once it's stored.
 */

export function startLikes(c: Ctx, drawerId: PlayerId): void {
  c.state.likes = { drawerId, likers: new Set() };
}

export function onLike(c: Ctx, playerId: PlayerId, liked: boolean): void {
  const { likes, phase, players } = c.state;
  if (!likes || (phase.kind !== 'drawing' && phase.kind !== 'reveal')) return;
  if (playerId === likes.drawerId || !players.has(playerId)) return;
  if (liked === likes.likers.has(playerId)) return;
  if (liked) likes.likers.add(playerId);
  else likes.likers.delete(playerId);
  sendToAll(c, { t: 'turn:likes', likers: [...likes.likers] });
}

/** As a reveal ends: does this drawing beat the cover? Then ask its drawer for a picture. */
export function considerCover(c: Ctx): void {
  const { state } = c;
  const { likes } = state;
  state.likes = null;
  if (!likes) return;
  const count = likes.likers.size;
  // A pending one only counts while its drawer can still send it.
  const pending = state.pendingCover;
  const pendingAlive = pending && state.players.get(pending.drawerId)?.connected === true;
  const best = Math.max(state.cover?.likes ?? 0, pendingAlive ? pending.likes : 0);
  if (count === 0 || count <= best) return;
  state.pendingCover = { turn: state.turnsPlayed, likes: count, drawerId: likes.drawerId };
  send(c, likes.drawerId, { t: 'cover:request', turn: state.turnsPlayed });
}

export function onCoverStored(c: Ctx, turn: number): void {
  const { state } = c;
  const pending = state.pendingCover;
  if (!pending || pending.turn !== turn) return;
  state.cover = { likes: pending.likes, version: (state.cover?.version ?? 0) + 1 };
  state.pendingCover = null;
}
