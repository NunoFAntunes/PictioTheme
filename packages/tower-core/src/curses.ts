import { randomInt, type Rng } from '@pictiotheme/game-core';
import { CURSES, cursesClash, type Curse } from '@pictiotheme/protocol/tower';
import type { PieceState } from './types';

/**
 * Curses (docs/tower/planning/power-ups.md): a cursed piece goes to the other crew, who must
 * place it. One is rolled when the piece is made, so the decider knows what Curse would do; a
 * golden word's piece gets two that don't clash (`cursesClash`). What each one does is
 * `curseEffects` (in the protocol, so the sandbox shares it).
 */

export function rollCurses(rng: Rng, golden = false): Curse[] {
  const first = CURSES[randomInt(rng, CURSES.length)] as Curse;
  if (!golden) return [first];
  const others = CURSES.filter((c) => !cursesClash(first, c));
  return [first, others[randomInt(rng, others.length)] as Curse];
}

/** The curses in effect: none unless the piece was cursed and sent. */
export const activeCurses = (piece: PieceState): Curse[] => (piece.sent ? piece.curses : []);
