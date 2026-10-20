import { seededRng } from '@pictiotheme/game-core';
import type { Card, PlayerId } from '@pictiotheme/protocol';
import type {
  Team,
  TowerClientMessage,
  TowerServerMessage,
  TowerSettings,
} from '@pictiotheme/protocol/tower';
import { createTowerRoomState, step } from './step';
import type { Effect, PhysicsOp, TimerId, TowerEvent } from './types';

/**
 * Drives the room like the server shell would, with a fake clock. The tests play the physics'
 * part: they send `released`, `fumbled` and `height` events themselves. Only used by tests.
 */

const card = (text: string, alternates: string[] = []): Card => ({
  text,
  kind: 'easy',
  alternates,
  keywords: [text.toLowerCase()],
});

export const TEST_WORDS: Card[] = ['Bucket', 'Lamp', 'Broom', 'Candle', 'Kettle', 'Ladder'].map(
  (w) => card(w),
);

/** A rectangle outline, drawn like a mouse would: it makes a solid brick. */
export function brickStrokes(id = 's1'): TowerClientMessage[] {
  const corners = [
    [300, 300],
    [900, 300],
    [900, 600],
    [300, 600],
    [300, 306],
  ] as const;
  const pts: number[] = [];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1] as readonly [number, number];
    const [bx, by] = corners[i] as readonly [number, number];
    for (let k = 1; k <= 20; k++) {
      pts.push(Math.round(ax + ((bx - ax) * k) / 20), Math.round(ay + ((by - ay) * k) / 20), 0.5);
    }
  }
  return [
    { t: 'draw:begin', id, tool: 'brush', color: '#000000', size: 10, opacity: 1, x: 300, y: 300 },
    { t: 'draw:pts', id, pts },
    { t: 'draw:end', id },
  ];
}

export function createHarness(
  options: { settings?: Partial<TowerSettings>; seed?: number; words?: Card[] } = {},
) {
  let now = 1_000_000;
  const rng = seededRng(options.seed ?? 1);
  const state = createTowerRoomState({ code: 'ABC-DEF', hostId: 'p1', now });
  state.settings = { ...state.settings, ...options.settings };
  const timers = new Map<TimerId, number>();
  const sent: { to: PlayerId; msg: TowerServerMessage }[] = [];
  const physics: { tower: Team; physics: PhysicsOp }[] = [];
  const effects: Effect[] = [];

  function dispatch(event: TowerEvent): Effect[] {
    const fx = step(state, event, { now, rng });
    for (const e of fx) {
      effects.push(e);
      if (e.kind === 'schedule') timers.set(e.timer, e.at);
      if (e.kind === 'cancel') timers.delete(e.timer);
      if (e.kind === 'send') for (const to of e.to) sent.push({ to, msg: e.msg });
      if (e.kind === 'physics') physics.push({ tower: e.tower, physics: e.physics });
    }
    return fx;
  }

  dispatch({ type: 'init' });
  dispatch({ type: 'wordsLoaded', cards: options.words ?? TEST_WORDS });

  const h = {
    state,
    timers,
    sent,
    physics,
    effects,
    get now() {
      return now;
    },
    dispatch,

    join(id: PlayerId, name = id): void {
      dispatch({ type: 'join', player: { id, name, avatar: '0'.repeat(32) } });
    },
    leave(id: PlayerId): void {
      dispatch({ type: 'disconnect', playerId: id });
    },
    msg(id: PlayerId, msg: TowerClientMessage): Effect[] {
      return dispatch({ type: 'message', playerId: id, msg });
    },

    /** Moves the clock forward, firing due timers in time order. */
    advance(ms: number): void {
      const target = now + ms;
      for (;;) {
        let next: [TimerId, number] | null = null;
        for (const entry of timers)
          if (entry[1] <= target && (!next || entry[1] < next[1])) next = entry;
        if (!next) break;
        timers.delete(next[0]);
        now = Math.max(now, next[1]);
        dispatch({ type: 'timer', timer: next[0] });
      }
      now = target;
    },

    /** Messages sent to a player since `since` (an index into `sent`), optionally of one type. */
    to<T extends TowerServerMessage['t']>(id: PlayerId, t?: T, since = 0) {
      return sent
        .slice(since)
        .filter((s) => s.to === id && (!t || s.msg.t === t))
        .map((s) => s.msg as Extract<TowerServerMessage, { t: T }>);
    },
    mark(): number {
      return sent.length;
    },

    crew(team: Team) {
      const crew = state.match?.crews[team];
      if (!crew) throw new Error('no match');
      return crew;
    },
    /** The current drawer of a crew. */
    drawer(team: Team): PlayerId {
      const id = h.crew(team).round?.drawerId;
      if (!id) throw new Error(`${team} has no round`);
      return id;
    },
    word(team: Team): string {
      const text = h.crew(team).round?.card.text;
      if (!text) throw new Error(`${team} has no round`);
      return text;
    },
    /** A crew member who isn't drawing or placing. */
    guesser(team: Team): PlayerId {
      const drawer = h.drawer(team);
      const placer = h.crew(team).placing?.placerId;
      const p = [...state.players.values()].find(
        (x) => x.team === team && x.id !== drawer && x.id !== placer && x.connected,
      );
      if (!p) throw new Error(`${team} has no guesser`);
      return p.id;
    },
    /** The crew's drawer draws a brick. */
    drawBrick(team: Team): void {
      for (const m of brickStrokes(`b${now}`)) h.msg(h.drawer(team), m);
    },

    /** Four players, two per crew (p1 host, orange: p1 p3, teal: p2 p4), match started. */
    startFour(): void {
      h.startWith(4);
    },
    /** `n` players p1…pn, alternating crews (orange gets the odd ones), match started. */
    startWith(n: number): void {
      for (let i = 1; i <= n; i++) h.join(`p${i}`);
      h.msg('p1', { t: 'match:start' });
      if (state.phase !== 'playing') throw new Error('match did not start');
    },
  };
  return h;
}

export type Harness = ReturnType<typeof createHarness>;
