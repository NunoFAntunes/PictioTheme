import {
  DEFAULT_TOWER_SETTINGS,
  type TowerPiece,
  type TowerSnapshot,
} from '@pictiotheme/protocol/tower';
import { describe, expect, it } from 'vitest';
import { applyServerMessage, myTeam, viewFromSnapshot, type RoomView } from './room-view';

const crew = {
  round: null,
  queue: [],
  placing: null,
  dazedUntil: null,
  height: 0,
  toppingUntil: null,
};

const snapshot: TowerSnapshot = {
  t: 'room:snapshot',
  you: 'p1',
  code: 'ABC-DEF',
  hostId: 'p1',
  settings: DEFAULT_TOWER_SETTINGS,
  phase: 'playing',
  players: [
    { id: 'p1', name: 'Ana', avatar: '0'.repeat(32), connected: true, team: 'orange' },
    { id: 'p2', name: 'Bo', avatar: '1'.repeat(32), connected: true, team: 'teal' },
  ],
  crews: { orange: crew, teal: crew },
  pieces: [],
  deciding: [],
  matchEndsAt: 2_000_000,
  results: null,
  serverTime: 1_000_000,
};

const piece: TowerPiece = {
  id: 7,
  word: 'Bucket',
  team: 'orange',
  drawnBy: 'p3',
  solvedBy: 'p1',
  stolen: false,
  tower: null,
  sent: false,
  fumbled: false,
  shape: {
    outline: [0, 0, 1, 0, 1, 1],
    parts: [[0, 0, 1, 0, 1, 1]],
    area: 0.5,
    scale: 0.01,
    origin: { x: 0, y: 0 },
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    limitedBy: 'area',
    silhouette: [0, 0, 1, 0, 1, 1],
    cell: 8,
  },
  strokes: [],
};

const start = () => viewFromSnapshot(snapshot, null);
const apply = (view: RoomView, ...msgs: Parameters<typeof applyServerMessage>[1][]) =>
  msgs.reduce((v, m) => applyServerMessage(v, m, 1_000_000), view);

describe('room view', () => {
  it('starts from the snapshot', () => {
    const view = start();
    expect(myTeam(view)).toBe('orange');
    expect(view.pieces).toEqual({});
    expect(view.feed).toEqual([]);
  });

  it('follows a round from start to hint to end', () => {
    const round = {
      id: 3,
      drawerId: 'p3',
      startedAt: 0,
      endsAt: 60_000,
      mask: '______',
      strokes: [],
    };
    let view = apply(start(), { t: 'round:start', team: 'orange', round });
    expect(view.crews.orange.round?.mask).toBe('______');
    view = apply(view, { t: 'round:hint', team: 'orange', roundId: 3, mask: '_u____' });
    expect(view.crews.orange.round?.mask).toBe('_u____');
    view = apply(view, {
      t: 'round:end',
      team: 'orange',
      roundId: 3,
      outcome: 'stolen',
      word: 'Bucket',
      solverId: 'p2',
    });
    expect(view.crews.orange.round).toBeNull();
    expect(view.events.at(-1)).toMatchObject({ kind: 'stolen', team: 'orange', playerId: 'p2' });
  });

  it('follows a piece from made to queued to placed', () => {
    let view = apply(start(), {
      t: 'piece:made',
      piece,
      deciding: { pieceId: 7, solverId: 'p1', endsAt: 1_005_000 },
    });
    expect(view.deciding).toHaveLength(1);
    view = apply(view, { t: 'piece:queued', pieceId: 7, tower: 'teal', sent: true });
    expect(view.deciding).toEqual([]);
    expect(view.pieces[7]).toMatchObject({ tower: 'teal', sent: true });
    expect(view.crews.teal.queue).toEqual([7]);
    expect(view.events.at(-1)?.kind).toBe('sent');
    view = apply(view, {
      t: 'place:start',
      tower: 'teal',
      placing: { pieceId: 7, placerId: 'p2', endsAt: 1_015_000 },
    });
    expect(view.crews.teal.queue).toEqual([]);
    expect(view.crews.teal.placing?.placerId).toBe('p2');
    view = apply(view, { t: 'tower:fumble', tower: 'teal', pieceIds: [7], dazedUntil: 1_005_000 });
    expect(view.pieces[7]?.fumbled).toBe(true);
    expect(view.crews.teal.placing).toBeNull();
    expect(view.crews.teal.dazedUntil).toBe(1_005_000);
  });

  it('keeps your guesses and your crew’s in the feed, and the steal cooldown', () => {
    const view = apply(
      start(),
      {
        t: 'guess:result',
        target: 'steal',
        text: 'bucket',
        result: 'wrong',
        cooldownUntil: 1_002_000,
      },
      { t: 'crew:feed', playerId: 'p3', target: 'own', text: 'lamp' },
      { t: 'crew:feed', playerId: 'p3', target: 'own', solved: true },
    );
    expect(view.feed.map((f) => [f.playerId, f.text, f.result])).toEqual([
      ['p1', 'bucket', 'wrong'],
      ['p3', 'lamp', undefined],
      ['p3', null, undefined],
    ]);
    expect(view.stealCooldownUntil).toBe(1_002_000);
  });

  it('ends the match into the results', () => {
    const results = {
      winner: 'teal' as const,
      reason: 'topped_out' as const,
      heights: { orange: 4, teal: 10.2 },
      players: [],
      awards: [],
    };
    const view = apply(start(), { t: 'match:end', results });
    expect(view.phase).toBe('results');
    expect(view.results?.winner).toBe('teal');
  });
});
