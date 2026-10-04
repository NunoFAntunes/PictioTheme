import type { PlayerId, RoomSettings } from '@pictiotheme/protocol';
import { finishMatch, onHintTimer, onPhaseTimer } from './match';
import { deckRef, onMessage } from './messages';
import { schedule, sendToAll } from './output';
import {
  onDisconnect,
  onDrawerGraceTimer,
  onHostGraceTimer,
  onJoin,
  onPlayerGraceTimer,
} from './players';
import {
  TIMINGS,
  type Ctx,
  type Effect,
  type RoomEvent,
  type RoomState,
  type StepContext,
  type TimerId,
} from './types';

export function createRoomState(input: {
  code: string;
  name: string;
  isPublic: boolean;
  hostId: PlayerId;
  settings: RoomSettings;
  now: number;
}): RoomState {
  return {
    code: input.code,
    name: input.name,
    isPublic: input.isPublic,
    createdAt: input.now,
    hostId: input.hostId,
    settings: input.settings,
    players: new Map(),
    banned: new Set(),
    deck: null,
    phase: { kind: 'waiting' },
    paused: null,
    round: 0,
    turnOrder: [],
    turnIndex: -1,
    pool: { remaining: [], used: [] },
    strokes: [],
    redo: [],
    pointsThisTurn: 0,
    opSeq: 0,
    kickVotes: new Map(),
    matchStartedAt: null,
    turnsPlayed: 0,
  };
}

/**
 * Applies one event to the room. Mutates `state` (each room owns its state exclusively)
 * and returns the effects the shell must run: sends, timers, deck loads, persistence.
 */
export function step(state: RoomState, event: RoomEvent, ctx: StepContext): Effect[] {
  const c: Ctx = { ...ctx, state, fx: [] };
  switch (event.type) {
    case 'init':
      c.fx.push({ kind: 'loadDeck', deckId: state.settings.deckId });
      schedule(c, 'idle', c.now + TIMINGS.idleMs);
      break;
    case 'join':
      onJoin(c, event.player);
      break;
    case 'disconnect':
      onDisconnect(c, event.playerId);
      break;
    case 'message':
      onMessage(c, event.playerId, event.msg);
      break;
    case 'timer':
      onTimer(c, event.timer);
      break;
    case 'deckLoaded':
      if (event.deck.id === state.settings.deckId) {
        state.deck = event.deck;
        sendToAll(c, { t: 'room:settings', settings: state.settings, deck: deckRef(c) });
      }
      break;
    case 'deckFailed':
      if (event.deckId === state.settings.deckId) {
        sendToAll(c, { t: 'room:notice', code: 'deck_unavailable' });
      }
      break;
  }
  return c.fx;
}

function onTimer(c: Ctx, timer: TimerId): void {
  const { phase, paused } = c.state;
  if (timer.startsWith('grace:')) {
    onPlayerGraceTimer(c, timer.slice('grace:'.length));
    return;
  }
  switch (timer) {
    case 'phase':
      onPhaseTimer(c);
      return;
    case 'hint':
      onHintTimer(c);
      return;
    case 'drawer-grace':
      onDrawerGraceTimer(c);
      return;
    case 'host-grace':
      onHostGraceTimer(c);
      return;
    case 'idle':
      if (phase.kind === 'waiting' || phase.kind === 'results') c.fx.push({ kind: 'close' });
      return;
    case 'alone':
      // Nobody came back: end the match (so it is recorded) and close the room.
      if (paused?.reason === 'players') {
        finishMatch(c, 'abandoned');
        c.fx.push({ kind: 'close' });
      }
      return;
  }
}
