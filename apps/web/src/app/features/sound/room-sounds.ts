import type { ServerMessage } from '@pictiotheme/protocol';
import type { RoomView } from '../../realtime';
import type { SoundId } from './sound-catalog';

/**
 * Which sounds a room message triggers, from the views before and after it. Pure, so it is
 * unit-tested. The card table plays its own shuffle/deal/flip sounds in time with its animation.
 */
export function soundsForMessage(
  msg: ServerMessage,
  before: RoomView | null,
  after: RoomView,
): SoundId[] {
  // A snapshot (joining, reconnecting) is catching up, not something that just happened.
  if (msg.t === 'room:snapshot' || !before || before.code !== after.code) return [];
  const you = after.you;

  switch (msg.t) {
    case 'phase:choosing':
      return msg.drawerId === you ? ['yourTurn'] : [];
    case 'guess:self':
      return msg.kind === 'correct' ? ['guessCorrect'] : msg.kind === 'close' ? ['guessClose'] : [];
    case 'turn:solved':
      return msg.playerId === you ? [] : ['guessSolved'];
    case 'guess:feed':
      // Other players' guesses read like chat; correct ones arrive as turn:solved.
      return msg.playerId !== you && msg.kind !== 'correct' ? ['chat'] : [];
    case 'chat':
      return msg.playerId === you ? [] : ['chat'];
    case 'hint':
      return before.phase.kind === 'drawing' && before.phase.mask !== msg.mask ? ['hint'] : [];
    case 'phase:reveal':
      return before.phase.kind === 'drawing' ? ['timeUp'] : [];
    // The results screen plays its own ceremony sounds (features/results).
    case 'room:players': {
      const had = new Set(before.players.map((p) => p.id));
      const has = new Set(after.players.map((p) => p.id));
      const sounds: SoundId[] = [];
      if (after.players.some((p) => !had.has(p.id))) sounds.push('playerJoin');
      if (before.players.some((p) => !has.has(p.id))) sounds.push('playerLeave');
      return sounds;
    }
    default:
      return [];
  }
}

/** The clock ticks through the last seconds of a turn, alternating tick and tock. */
export const TICK_FROM_SECONDS = 10;

export function tickFor(secondsLeft: number): { rate: number; volume: number } | null {
  if (secondsLeft <= 0 || secondsLeft > TICK_FROM_SECONDS) return null;
  return {
    rate: secondsLeft % 2 === 0 ? 1 : 0.8,
    // Gets a little louder as time runs out.
    volume: 0.6 + (0.4 * (TICK_FROM_SECONDS - secondsLeft)) / (TICK_FROM_SECONDS - 1),
  };
}
