import { myTeam, type RoomView } from '../../realtime';
import type { GameCue } from './game-sounds';

/**
 * Which sounds a change in the room makes (pure, unit-tested): only what matters to you, from
 * where you stand. Nothing on the first view or a new room's: a reconnect shouldn't replay the
 * match.
 */
export function roomCues(prev: RoomView | null, next: RoomView): GameCue[] {
  if (!prev || prev.code !== next.code) return [];
  const cues: GameCue[] = [];
  const team = myTeam(next);

  if (prev.phase !== next.phase) {
    if (next.phase === 'playing') cues.push('start');
    if (next.phase === 'results' && next.results) {
      const winner = next.results.winner;
      cues.push(winner === null ? 'draw' : winner === team ? 'win' : 'lose');
    }
    return cues;
  }

  if (next.phase === 'waiting') {
    if (next.players.length > prev.players.length) cues.push('join');
    return cues;
  }
  if (next.phase !== 'playing' || !team) return cues;

  const rival = team === 'orange' ? 'teal' : 'orange';
  const was = prev.crews[team];
  const crew = next.crews[team];

  if (crew.round && crew.round.id !== was.round?.id && crew.round.drawerId === next.you)
    cues.push('draw-turn');
  if (
    crew.placing &&
    crew.placing.pieceId !== was.placing?.pieceId &&
    crew.placing.placerId === next.you
  )
    cues.push('place-turn');

  const lastFeed = prev.feed.at(-1)?.key ?? 0;
  for (const entry of next.feed) {
    if (entry.key <= lastFeed) continue;
    if (entry.result === 'correct') cues.push(entry.target === 'steal' ? 'stole' : 'correct');
    else if (entry.result) cues.push(entry.result);
    else if (entry.text === null) cues.push(entry.target === 'steal' ? 'stole' : 'crew-solved');
  }

  const lastEvent = prev.events.at(-1)?.key ?? 0;
  let fumbled = false;
  for (const event of next.events) {
    if (event.key <= lastEvent || event.team !== team) continue;
    if (event.kind === 'stolen') cues.push('robbed');
    if (event.kind === 'expired') cues.push('expired');
    if (event.kind === 'sent') cues.push('incoming');
    if (event.kind === 'fumble') {
      fumbled = true;
      cues.push('fumble');
    }
  }
  if (was.placing && !crew.placing && !fumbled) cues.push('placed');

  if (crew.toppingUntil !== null && was.toppingUntil === null) cues.push('topping');
  if (next.crews[rival].toppingUntil !== null && prev.crews[rival].toppingUntil === null)
    cues.push('rival-topping');

  return cues;
}

/**
 * The tick for this many whole seconds left: the match's last ten, and the last three of your
 * own placing. Null when it's not time to tick.
 */
export function countdownCue(secondsLeft: number, limit: number): GameCue | null {
  if (secondsLeft < 1 || secondsLeft > limit) return null;
  return secondsLeft <= 3 ? 'tick-last' : 'tick';
}
