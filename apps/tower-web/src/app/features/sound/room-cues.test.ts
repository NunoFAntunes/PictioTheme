import {
  DEFAULT_TOWER_SETTINGS,
  type TowerPiece,
  type TowerServerMessage,
} from '@pictiotheme/protocol/tower';
import { describe, expect, it } from 'vitest';
import { type RoomView } from '../../realtime';
import { applyServerMessage, viewFromSnapshot } from '../../realtime/room-view';
import { countdownCue, roomCues, startedSpells } from './room-cues';

const crew = {
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

const start = (phase: RoomView['phase'] = 'playing') =>
  viewFromSnapshot(
    {
      t: 'room:snapshot',
      you: 'p1',
      code: 'ABC-DEF',
      hostId: 'p1',
      settings: DEFAULT_TOWER_SETTINGS,
      phase,
      players: [
        { id: 'p1', name: 'Ana', avatar: '0'.repeat(32), connected: true, team: 'orange' },
        { id: 'p2', name: 'Bo', avatar: '1'.repeat(32), connected: true, team: 'teal' },
      ],
      crews: { orange: crew, teal: crew },
      pieces: [],
      deciding: [],
      matchEndsAt: phase === 'playing' ? 2_000_000 : null,
      results: null,
      serverTime: 1_000_000,
    },
    null,
  );

/** The cues of applying `msg` to `view`. */
const cues = (view: RoomView, msg: TowerServerMessage) =>
  roomCues(view, applyServerMessage(view, msg, 1_000_000));

const round = (id: number, drawerId: string) => ({
  id,
  drawerId,
  startedAt: 0,
  endsAt: 60_000,
  mask: '______',
  golden: false,
  strokes: [],
});

describe('room cues', () => {
  it('stays quiet on the first view and on another room', () => {
    expect(roomCues(null, start())).toEqual([]);
    expect(roomCues({ ...start(), code: 'XYZ-XYZ' }, start())).toEqual([]);
  });

  it('starts the match and ends it from where you stand', () => {
    const waiting = start('waiting');
    expect(roomCues(waiting, { ...waiting, phase: 'playing' })).toEqual(['start']);
    const results = (winner: 'orange' | 'teal' | null) => ({
      t: 'match:end' as const,
      results: {
        winner,
        reason: 'time' as const,
        heights: { orange: 1, teal: 1 },
        players: [],
        awards: [],
      },
    });
    expect(cues(start(), results('orange'))).toEqual(['win']);
    expect(cues(start(), results('teal'))).toEqual(['lose']);
    expect(cues(start(), results(null))).toEqual(['draw']);
  });

  it('pops when someone joins the waiting room', () => {
    const waiting = start('waiting');
    const joined = {
      ...waiting,
      players: [
        ...waiting.players,
        { id: 'p3', name: 'Cy', avatar: '2'.repeat(32), connected: true, team: null },
      ],
    };
    expect(roomCues(waiting, joined)).toEqual(['join']);
  });

  it('calls you to draw and to place, not someone else', () => {
    expect(cues(start(), { t: 'round:start', team: 'orange', round: round(1, 'p1') })).toEqual([
      'draw-turn',
    ]);
    expect(cues(start(), { t: 'round:start', team: 'orange', round: round(1, 'p3') })).toEqual([]);
    const place = (placerId: string) => ({
      t: 'place:start' as const,
      tower: 'orange' as const,
      placing: { pieceId: 7, placerId, endsAt: 1_015_000 },
    });
    expect(cues(start(), place('p1'))).toEqual(['place-turn']);
    expect(cues(start(), place('p3'))).toEqual([]);
  });

  it('answers your guesses and your crew’s solves and steals', () => {
    const guess = (result: 'wrong' | 'close' | 'correct', target: 'own' | 'steal' = 'own') =>
      cues(start(), { t: 'guess:result', target, text: 'bucket', result });
    expect(guess('wrong')).toEqual(['wrong']);
    expect(guess('close')).toEqual(['close']);
    expect(guess('correct')).toEqual(['correct']);
    expect(guess('correct', 'steal')).toEqual(['stole']);
    const feed = (target: 'own' | 'steal') =>
      cues(start(), { t: 'crew:feed', playerId: 'p3', target, solved: true });
    expect(feed('own')).toEqual(['crew-solved']);
    expect(feed('steal')).toEqual(['stole']);
    expect(cues(start(), { t: 'crew:feed', playerId: 'p3', target: 'own', text: 'pail' })).toEqual(
      [],
    );
  });

  it('sounds the blows to your tower only', () => {
    const end = (team: 'orange' | 'teal', outcome: 'stolen' | 'expired') =>
      cues(start(), { t: 'round:end', team, roundId: 1, outcome, word: 'Bucket' });
    expect(end('orange', 'stolen')).toEqual(['robbed']);
    expect(end('teal', 'stolen')).toEqual([]);
    expect(end('orange', 'expired')).toEqual(['expired']);
  });

  it('thuds a piece let go on your tower, but a fumble is a fumble', () => {
    const placing = applyServerMessage(
      start(),
      {
        t: 'place:start',
        tower: 'orange',
        placing: { pieceId: 7, placerId: 'p3', endsAt: 1_015_000 },
      },
      1_000_000,
    );
    expect(cues(placing, { t: 'place:end', tower: 'orange', pieceId: 7 })).toEqual(['placed']);
    expect(
      cues(placing, { t: 'tower:fumble', tower: 'orange', pieceIds: [7], dazedUntil: null }),
    ).toEqual(['fumble']);
  });

  it('shimmers when your tower goes over the line, and warns when theirs does', () => {
    const over = (tower: 'orange' | 'teal') =>
      cues(start(), { t: 'tower:height', tower, height: 10.2, toppingUntil: 1_005_000 });
    expect(over('orange')).toEqual(['topping']);
    expect(over('teal')).toEqual(['rival-topping']);
  });
});

describe('countdown cue', () => {
  it('ticks the last seconds, sharper for the last three', () => {
    expect(countdownCue(11, 10)).toBeNull();
    expect(countdownCue(10, 10)).toBe('tick');
    expect(countdownCue(3, 10)).toBe('tick-last');
    expect(countdownCue(0, 10)).toBeNull();
  });
});

describe('power cues', () => {
  const apply = (view: RoomView, msg: TowerServerMessage) =>
    applyServerMessage(view, msg, 1_000_000);
  const spell = (kind: 'fog' | 'pigeon' | 'magpie') => ({
    spell: kind,
    casterId: 'p2',
    startsAt: 1_002_000,
    endsAt: 1_012_000,
  });

  it('marks a golden word for either crew', () => {
    const golden = { ...round(5, 'p2'), golden: true };
    expect(cues(start(), { t: 'round:start', team: 'teal', round: golden })).toEqual(['golden']);
    expect(cues(start(), { t: 'round:start', team: 'teal', round: round(5, 'p2') })).toEqual([]);
  });

  it('chimes for your crew’s new spells and caught stars, not the other crew’s', () => {
    const gained = (team: 'orange' | 'teal', reason: 'golden' | 'star') =>
      cues(start(), {
        t: 'crew:charges',
        team,
        charges: ['fog'],
        gained: { spell: 'fog', reason },
      });
    expect(gained('orange', 'golden')).toEqual(['spell-gained']);
    expect(gained('orange', 'star')).toEqual(['star-caught']);
    expect(gained('teal', 'golden')).toEqual([]);
  });

  it('twinkles when a star appears by your tower, and rises while it’s held', () => {
    const star = { x: 3.6, y: 2, expiresAt: 1_045_000, holdUntil: null };
    expect(cues(start(), { t: 'crew:star', team: 'orange', star })).toEqual(['star-appear']);
    expect(cues(start(), { t: 'crew:star', team: 'teal', star })).toEqual([]);
    const shown = apply(start(), { t: 'crew:star', team: 'orange', star });
    expect(
      cues(shown, { t: 'crew:star', team: 'orange', star: { ...star, holdUntil: 1_003_000 } }),
    ).toEqual(['star-hold']);
  });

  it('whooshes a cast off, warns the tower it’s cast at, and flaps a pigeon away', () => {
    expect(cues(start(), { t: 'crew:spell', team: 'teal', spell: spell('fog') })).toEqual(['cast']);
    expect(cues(start(), { t: 'crew:spell', team: 'orange', spell: spell('fog') })).toEqual([
      'spell-incoming',
    ]);
    const perched = apply(start(), { t: 'crew:spell', team: 'teal', spell: spell('pigeon') });
    expect(cues(perched, { t: 'crew:spell', team: 'teal', spell: null })).toEqual(['pigeon-off']);
  });

  it('caws when a magpie takes a piece, and when one finds nothing', () => {
    const circling = apply(start(), { t: 'crew:spell', team: 'teal', spell: spell('magpie') });
    const took = apply(circling, {
      t: 'piece:magpied',
      pieceId: 7,
      from: 'teal',
      to: 'orange',
      casterId: 'p1',
    });
    expect(roomCues(circling, took)).toEqual(['magpie-took']);
    expect(cues(took, { t: 'crew:spell', team: 'teal', spell: null })).toEqual([]);
    expect(cues(circling, { t: 'crew:spell', team: 'teal', spell: null })).toEqual(['magpie-off']);
  });

  it('lands a cursed piece on your tower with its curse’s sound', () => {
    const piece: TowerPiece = {
      id: 7,
      word: 'Bucket',
      team: 'teal',
      drawnBy: 'p2',
      solvedBy: 'p2',
      deciderId: 'p2',
      stolen: false,
      tower: 'orange',
      sent: true,
      curses: ['bouncy'],
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
    let view = apply(start(), {
      t: 'piece:made',
      piece,
      deciding: { pieceId: 7, deciderId: 'p2', endsAt: 1_005_000 },
    });
    view = apply(view, {
      t: 'place:start',
      tower: 'orange',
      placing: { pieceId: 7, placerId: 'p1', endsAt: 1_015_000 },
    });
    expect(cues(view, { t: 'place:end', tower: 'orange', pieceId: 7 })).toEqual([
      'placed',
      'boing',
    ]);
  });

  it('knows when each spell has started, once its warning is over', () => {
    const view = apply(start(), { t: 'crew:spell', team: 'teal', spell: spell('fog') });
    expect(startedSpells(view, 1_001_000)).toEqual([]);
    expect(startedSpells(view, 1_003_000)).toEqual([{ key: 'teal 1002000', cue: 'fog' }]);
    expect(startedSpells(view, 1_013_000)).toEqual([]);
  });
});
