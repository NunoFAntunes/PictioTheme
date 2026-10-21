import type { PlayerId } from '@pictiotheme/protocol';
import {
  DEFAULT_TOWER_SETTINGS,
  TEAMS,
  type Team,
  type TowerClientMessage,
  type TowerSettings,
} from '@pictiotheme/protocol/tower';
import { onDraw } from './drawing';
import {
  canStart,
  onCast,
  onDazeTimer,
  onDecide,
  onDecideTimer,
  onDrop,
  onFumbled,
  onGuess,
  onHeight,
  onHintTimer,
  onMatchTimer,
  onPigeonGone,
  onPlaceTimer,
  onReleased,
  onRoundTimer,
  onSpellTimer,
  onSteer,
  onToppingTimer,
  startMatch,
} from './match';
import { schedule, send, sendError } from './output';
import { onStarsTimer, onStarTimer } from './stars';
import { onTest } from './test-mode';
import {
  onCrewJoin,
  onCrewMove,
  onCrewShuffle,
  onDisconnect,
  onIdentity,
  onEmptyTimer,
  onGraceTimer,
  onHostGraceTimer,
  onJoin,
  onRematch,
  onSettings,
} from './players';
import {
  TIMINGS,
  type Ctx,
  type Effect,
  type StepContext,
  type TimerId,
  type TowerEvent,
  type TowerRoomState,
} from './types';

export function createTowerRoomState(input: {
  code: string;
  hostId: PlayerId;
  now: number;
  settings?: TowerSettings;
}): TowerRoomState {
  return {
    code: input.code,
    createdAt: input.now,
    hostId: input.hostId,
    settings: input.settings ?? DEFAULT_TOWER_SETTINGS,
    players: new Map(),
    phase: 'waiting',
    words: null,
    match: null,
    results: null,
  };
}

/**
 * Applies one event to the room. Mutates `state` (each room owns its state exclusively) and
 * returns the effects the shell must run: sends, timers, physics, persistence.
 */
export function step(state: TowerRoomState, event: TowerEvent, ctx: StepContext): Effect[] {
  const c: Ctx = { ...ctx, state, fx: [] };
  switch (event.type) {
    case 'init':
      c.fx.push({ kind: 'loadWords' });
      schedule(c, 'idle', c.now + TIMINGS.idleMs);
      break;
    case 'join':
      onJoin(c, event.player);
      break;
    case 'disconnect':
      onDisconnect(c, event.playerId);
      break;
    case 'identity':
      onIdentity(c, event.playerId, event.name, event.avatar);
      break;
    case 'message':
      onMessage(c, event.playerId, event.msg);
      break;
    case 'timer':
      onTimer(c, event.timer);
      break;
    case 'wordsLoaded':
      state.words = event.cards;
      break;
    case 'released':
      onReleased(c, event.tower, event.pieceId);
      break;
    case 'fumbled':
      onFumbled(c, event.tower, event.pieceIds);
      break;
    case 'pigeonGone':
      onPigeonGone(c, event.tower);
      break;
    case 'height':
      onHeight(c, event.tower, event.height, event.starHeld);
      break;
  }
  return c.fx;
}

function onMessage(c: Ctx, playerId: PlayerId, msg: TowerClientMessage): void {
  if (!c.state.players.get(playerId)?.connected) return;
  switch (msg.t) {
    case 'ping':
      send(c, playerId, { t: 'pong', ts: msg.ts, serverTime: c.now });
      return;
    case 'crew:join':
      onCrewJoin(c, playerId, msg.team);
      return;
    case 'crew:move':
      onCrewMove(c, playerId, msg.playerId, msg.team);
      return;
    case 'crew:shuffle':
      onCrewShuffle(c, playerId);
      return;
    case 'settings:update':
      onSettings(c, playerId, msg.settings);
      return;
    case 'match:start': {
      if (c.state.hostId !== playerId) {
        sendError(c, playerId, 'NOT_HOST', 'Only the host can start the match');
        return;
      }
      if (c.state.phase !== 'waiting') {
        sendError(c, playerId, 'WRONG_PHASE', 'The match has already started');
        return;
      }
      if (!c.state.words?.length) {
        sendError(c, playerId, 'DECK_NOT_READY', 'The words are still loading');
        return;
      }
      const problem = canStart(c);
      if (problem) {
        sendError(c, playerId, 'NOT_ENOUGH_PLAYERS', problem);
        return;
      }
      startMatch(c);
      return;
    }
    case 'match:rematch':
      onRematch(c, playerId);
      return;
    case 'draw:begin':
    case 'draw:pts':
    case 'draw:end':
    case 'draw:fill':
    case 'draw:undo':
    case 'draw:redo':
    case 'draw:clear':
      onDraw(c, playerId, msg);
      return;
    case 'guess':
      onGuess(c, playerId, msg.text);
      return;
    case 'piece:decide':
      onDecide(c, playerId, msg.pieceId, msg.choice);
      return;
    case 'place:steer': {
      const { t: _t, ...steer } = msg;
      onSteer(c, playerId, steer);
      return;
    }
    case 'place:drop':
      onDrop(c, playerId);
      return;
    case 'spell:cast':
      onCast(c, playerId, msg.slot);
      return;
    case 'test':
      onTest(c, playerId, msg.action);
      return;
  }
}

const teamOf = (timer: string, prefix: string): Team | null => {
  const team = timer.slice(prefix.length);
  return (TEAMS as readonly string[]).includes(team) ? (team as Team) : null;
};

function onTimer(c: Ctx, timer: TimerId): void {
  const perTeam: [string, (c: Ctx, team: Team) => void][] = [
    ['round:', onRoundTimer],
    ['hint:', onHintTimer],
    ['place:', onPlaceTimer],
    ['daze:', onDazeTimer],
    ['topping:', onToppingTimer],
    ['spell:', onSpellTimer],
    ['star:', onStarTimer],
  ];
  for (const [prefix, handler] of perTeam) {
    if (timer.startsWith(prefix)) {
      const team = teamOf(timer, prefix);
      if (team) handler(c, team);
      return;
    }
  }
  if (timer.startsWith('decide:')) {
    onDecideTimer(c, Number(timer.slice('decide:'.length)));
    return;
  }
  if (timer.startsWith('grace:')) {
    onGraceTimer(c, timer.slice('grace:'.length));
    return;
  }
  switch (timer) {
    case 'host-grace':
      onHostGraceTimer(c);
      return;
    case 'match':
      onMatchTimer(c);
      return;
    case 'stars':
      onStarsTimer(c);
      return;
    case 'empty':
      onEmptyTimer(c);
      return;
    case 'idle':
      if (c.state.phase !== 'playing') c.fx.push({ kind: 'close' });
      return;
  }
}
