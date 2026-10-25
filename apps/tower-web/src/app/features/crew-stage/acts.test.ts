import { DEFAULT_TOWER_SETTINGS, type CrewView } from '@pictiotheme/protocol/tower';
import { describe, expect, it } from 'vitest';
import type { RoomEvent, RoomView } from '../../realtime';
import { viewFromSnapshot } from '../../realtime/room-view';
import { actsAfter, lastEventKey, shivering } from './acts';

const idle: CrewView = {
  round: null,
  queue: [],
  placing: null,
  dazedUntil: null,
  height: 0,
  toppingUntil: null,
  charges: [],
  spell: null,
  star: null,
};

const base = viewFromSnapshot(
  {
    t: 'room:snapshot',
    you: 'ana',
    code: 'ABC-DEF',
    hostId: 'ana',
    settings: DEFAULT_TOWER_SETTINGS,
    phase: 'playing',
    players: [],
    crews: { orange: idle, teal: idle },
    pieces: [],
    deciding: [],
    matchEndsAt: 2_000_000,
    results: null,
    serverTime: 1_000_000,
  },
  null,
);

const withEvents = (events: Omit<RoomEvent, 'at'>[], crews: Partial<RoomView['crews']> = {}) => ({
  ...base,
  crews: { ...base.crews, ...crews },
  events: events.map((e) => ({ at: 0, ...e })),
});

describe('acts', () => {
  it('starts after the events already there', () => {
    const view = withEvents([{ key: 4, kind: 'stolen', team: 'teal', playerId: 'ana' }]);
    expect(lastEventKey(view)).toBe(4);
    expect(actsAfter(view, 4, 0)).toEqual([]);
    expect(lastEventKey(base)).toBe(0);
  });

  it('throws a cast spell at the target tower, landing as it starts', () => {
    const view = withEvents(
      [{ key: 1, kind: 'cast', team: 'teal', playerId: 'ana', spell: 'fog' }],
      {
        teal: {
          ...idle,
          spell: { spell: 'fog', casterId: 'ana', startsAt: 10_000, endsAt: 20_000 },
        },
      },
    );
    expect(actsAfter(view, 0, 8_400)).toEqual([
      {
        kind: 'throw',
        what: 'spell',
        by: 'ana',
        team: 'orange',
        target: 'teal',
        icon: '🌫️',
        color: '#dfe7f2',
        landInMs: 1_600,
      },
    ]);
    // Never instant, never forever.
    expect(actsAfter(view, 0, 9_990)[0]).toMatchObject({ landInMs: 650 });
    expect(actsAfter(view, 0, 0)[0]).toMatchObject({ landInMs: 2_200 });
  });

  it('hurls a curse over with its curses on it, and sends a thief to the drawing they stole', () => {
    const view = withEvents([
      { key: 1, kind: 'sent', team: 'teal', playerId: 'bo', curses: ['slippery'] },
      { key: 2, kind: 'stolen', team: 'orange', playerId: 'ed' },
    ]);
    const [curse, steal, startle] = actsAfter(view, 0, 0);
    expect(startle).toEqual({ kind: 'startle', team: 'orange' });
    expect(curse).toMatchObject({
      kind: 'throw',
      what: 'curse',
      by: 'bo',
      team: 'orange',
      target: 'teal',
    });
    expect(curse?.kind === 'throw' && curse.icon.startsWith('🌀')).toBe(true);
    expect(steal).toEqual({ kind: 'steal', by: 'ed', team: 'teal', robbed: 'orange' });
  });

  it('flies a gained spell into its crew’s slots, and has crews react to a solve or a fumble', () => {
    const view = withEvents([
      { key: 1, kind: 'gained', team: 'orange', spell: 'pigeon', reason: 'golden' },
      { key: 2, kind: 'fumble', team: 'orange' },
      { key: 3, kind: 'solved', team: 'teal', playerId: 'flo' },
      { key: 4, kind: 'expired', team: 'teal' },
    ]);
    expect(actsAfter(view, 0, 0)).toEqual([
      { kind: 'gained', team: 'orange', spell: 'pigeon', icon: '🐦', reason: 'golden' },
      { kind: 'rain', team: 'orange' },
      { kind: 'cheer', team: 'teal' },
    ]);
    expect(actsAfter({ ...view, phase: 'results' }, 0, 0)).toEqual([]);
  });

  it('shivers the drawer under a running Shaky hand', () => {
    const round = {
      id: 1,
      drawerId: 'ed',
      startedAt: 0,
      endsAt: 60_000,
      golden: false,
      strokes: [],
    };
    const view = withEvents([], {
      teal: {
        ...idle,
        round,
        spell: { spell: 'shaky', casterId: 'ana', startsAt: 1_000, endsAt: 11_000 },
      },
    });
    expect([...shivering(view, 500)]).toEqual([]);
    expect([...shivering(view, 5_000)]).toEqual(['ed']);
    expect([...shivering(view, 11_000)]).toEqual([]);
  });
});
