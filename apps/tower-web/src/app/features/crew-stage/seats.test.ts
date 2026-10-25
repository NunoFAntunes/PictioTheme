import { DEFAULT_TOWER_SETTINGS, type CrewView } from '@pictiotheme/protocol/tower';
import { describe, expect, it } from 'vitest';
import { viewFromSnapshot } from '../../realtime/room-view';
import { seatsOf, stageAnchor } from './seats';

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

const round = (drawerId: string) => ({
  id: 1,
  drawerId,
  startedAt: 0,
  endsAt: 60_000,
  golden: false,
  strokes: [],
});

const player = (id: string, team: 'orange' | 'teal', connected = true) => ({
  id,
  name: id,
  avatar: '0'.repeat(32),
  connected,
  team,
});

/** Ana, Bo, Cy and Di in orange (in that join order), Ed and Flo in teal. */
const view = (
  crews: { orange?: Partial<CrewView>; teal?: Partial<CrewView> },
  deciding: { pieceId: number; deciderId: string; endsAt: number }[] = [],
  phase: 'waiting' | 'playing' = 'playing',
) =>
  viewFromSnapshot(
    {
      t: 'room:snapshot',
      you: 'ana',
      code: 'ABC-DEF',
      hostId: 'ana',
      settings: DEFAULT_TOWER_SETTINGS,
      phase,
      players: [
        player('ana', 'orange'),
        player('ed', 'teal'),
        player('bo', 'orange'),
        player('cy', 'orange', false),
        player('flo', 'teal'),
        player('di', 'orange'),
      ],
      crews: { orange: { ...idle, ...crews.orange }, teal: { ...idle, ...crews.teal } },
      pieces: [],
      deciding,
      matchEndsAt: 2_000_000,
      results: null,
      serverTime: 1_000_000,
    },
    null,
  );

const everywhere = () => true;
const placing = (placerId: string) => ({ pieceId: 7, placerId, endsAt: 15_000 });

/** Each player's anchor, slot and count. */
const where = (seats: ReturnType<typeof seatsOf>) =>
  Object.fromEntries(seats.map((s) => [s.playerId, `${s.anchor} ${s.slot}/${s.of}`]));

describe('crew seats', () => {
  it('seats nobody outside a match', () => {
    expect(seatsOf(view({}, [], 'waiting'), everywhere)).toEqual([]);
  });

  it('puts the drawer on the pad, the placer on a cloud, the decider on the card, and the rest on the rim in join order', () => {
    const seats = seatsOf(
      view(
        { orange: { round: round('bo'), placing: placing('di') }, teal: { round: round('ed') } },
        [{ pieceId: 6, deciderId: 'ana', endsAt: 5_000 }],
      ),
      everywhere,
    );
    expect(where(seats)).toEqual({
      ana: 'deciding:ana 0/1',
      bo: 'pad:orange 0/1',
      cy: 'rim:orange 0/1',
      di: 'cloud:orange 0/1',
      ed: 'pad:teal 0/1',
      flo: 'rim:teal 0/1',
    });
  });

  it('puts a placer on their cloud even if they are also due to draw', () => {
    const seats = seatsOf(
      view({ orange: { round: round('bo'), placing: placing('bo') } }),
      everywhere,
    );
    expect(where(seats).bo).toBe('cloud:orange 0/1');
  });

  it('falls back to the rim when a seat has no anchor on screen', () => {
    const seats = seatsOf(
      view({ orange: { placing: placing('di') } }, [
        { pieceId: 6, deciderId: 'ed', endsAt: 5_000 },
      ]),
      (anchor) => anchor !== stageAnchor.cloud('orange') && !anchor.startsWith('deciding:'),
    );
    expect(where(seats)).toMatchObject({
      ana: 'rim:orange 0/4',
      di: 'rim:orange 3/4',
      ed: 'rim:teal 0/2',
    });
  });

  it('leaves out a crew with no rim on screen', () => {
    const seats = seatsOf(view({}), (anchor) => anchor !== stageAnchor.rim('teal'));
    expect(seats.map((s) => s.team)).not.toContain('teal');
  });

  it('shows the disconnected asleep', () => {
    const seats = seatsOf(view({}), everywhere);
    expect(seats.filter((s) => s.asleep).map((s) => s.playerId)).toEqual(['cy']);
  });
});
