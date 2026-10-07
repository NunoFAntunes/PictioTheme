import {
  DEFAULT_ROOM_SETTINGS,
  type Card,
  type ClientMessage,
  type Difficulty,
  type PlayerId,
  type RoomSettings,
  type ServerMessage,
} from '@pictiotheme/protocol';
import { seededRng } from '../rng';
import { createRoomState, step } from './step';
import type { DeckInfo, Effect, RoomEvent, TimerId } from './types';

/**
 * Drives the room state machine like the server shell would, with a fake clock.
 * Only used by tests.
 */

function card(text: string, difficulty: Difficulty, silly = false): Card {
  return {
    text,
    difficulty,
    silly,
    alternates: [],
    keywords: text.toLowerCase().split(' ').slice(0, 2),
  };
}

export const TEST_DECK: DeckInfo = {
  id: 'deck-test',
  title: 'Test Deck',
  coverId: null,
  language: 'en',
  cards: [
    ...['Pumpkin', 'Ghost', 'Bat', 'Candle', 'Spider', 'Broom'].map((t) => card(t, 'easy')),
    ...['Haunted house', 'Black cat', 'Witch hat', 'Scarecrow', 'Cauldron', 'Skeleton'].map((t) =>
      card(t, 'medium'),
    ),
    ...['Headless horseman', 'Full moon', 'Werewolf', 'Graveyard', 'Mummy', 'Seance'].map((t) =>
      card(t, 'hard'),
    ),
    ...['Vampire on a unicycle', 'Mummy doing yoga', 'Ghost plowing'].map((t) =>
      card(t, 'medium', true),
    ),
  ],
};

export function createHarness(options: { settings?: Partial<RoomSettings>; seed?: number } = {}) {
  let now = 1_000_000;
  const rng = seededRng(options.seed ?? 1);
  const state = createRoomState({
    code: 'ABC-DEF',
    name: 'Test room',
    isPublic: false,
    hostId: 'p1',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      difficulties: ['easy', 'medium', 'hard'],
      deckId: TEST_DECK.id,
      ...options.settings,
    },
    now,
  });
  const timers = new Map<TimerId, number>();
  const history: Effect[] = [];

  function dispatch(event: RoomEvent): Effect[] {
    const fx = step(state, event, { now, rng });
    for (const e of fx) {
      if (e.kind === 'schedule') timers.set(e.timer, e.at);
      if (e.kind === 'cancel') timers.delete(e.timer);
    }
    history.push(...fx);
    return fx;
  }

  const h = {
    state,
    timers,
    history,
    get now() {
      return now;
    },
    dispatch,
    init(): Effect[] {
      const fx = dispatch({ type: 'init' });
      dispatch({ type: 'deckLoaded', deck: TEST_DECK });
      return fx;
    },
    join(id: PlayerId, name = id): Effect[] {
      return dispatch({
        type: 'join',
        player: { id, name, avatar: 'cat', isRegistered: false },
      });
    },
    disconnect(id: PlayerId): Effect[] {
      return dispatch({ type: 'disconnect', playerId: id });
    },
    send(id: PlayerId, msg: ClientMessage): Effect[] {
      return dispatch({ type: 'message', playerId: id, msg });
    },
    /** Moves the clock forward, firing due timers in order. Returns every effect produced. */
    advance(ms: number): Effect[] {
      const target = now + ms;
      const fx: Effect[] = [];
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, at]) => at <= target)
          .sort((a, b) => a[1] - b[1])[0];
        if (!due) break;
        const [timer, at] = due;
        timers.delete(timer);
        now = Math.max(now, at);
        fx.push(...dispatch({ type: 'timer', timer }));
      }
      now = target;
      return fx;
    },
    /** Starts a match with p1 (host), p2, p3 and returns the choosing effects. */
    startWith(ids: PlayerId[] = ['p1', 'p2', 'p3']): Effect[] {
      h.init();
      for (const id of ids) h.join(id);
      return h.send('p1', { t: 'room:start' });
    },
    drawerId(): PlayerId {
      const { phase } = state;
      if (phase.kind !== 'choosing' && phase.kind !== 'drawing') throw new Error(phase.kind);
      return phase.drawerId;
    },
    /** The drawer picks the first option; returns the word. */
    chooseFirst(): string {
      const drawer = h.drawerId();
      h.send(drawer, { t: 'turn:choose', index: 0 });
      if (state.phase.kind !== 'drawing') throw new Error('not drawing');
      return state.phase.card.text;
    },
  };
  return h;
}

/** Messages a player received in these effects. */
export function received(fx: Effect[], playerId: PlayerId): ServerMessage[] {
  return fx.flatMap((e) => (e.kind === 'send' && e.to.includes(playerId) ? [e.msg] : []));
}

export function receivedOfType<T extends ServerMessage['t']>(
  fx: Effect[],
  playerId: PlayerId,
  t: T,
): Extract<ServerMessage, { t: T }>[] {
  return received(fx, playerId).filter((m): m is Extract<ServerMessage, { t: T }> => m.t === t);
}
