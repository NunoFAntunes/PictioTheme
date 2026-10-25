import type { AvatarId, PlayerId } from '@pictiotheme/protocol';
import { TEAMS, type Team } from '@pictiotheme/protocol/tower';
import type { RoomView } from '../../realtime';

/**
 * Where everyone's avatar is during a match (docs/tower/design/screens.md#the-crews-on-stage):
 * the drawer on their crew's drawing pad, a placer on a cloud by their tower, a decider on the
 * Keep-or-Curse card, everyone else perched on the rim of their crew's drawing. Pure: worked out
 * from the room view alone, so it needs nothing new from the server.
 */

export type SeatKind = 'pad' | 'rim' | 'deciding' | 'cloud';

export type Seat = {
  playerId: PlayerId;
  avatar: AvatarId;
  team: Team;
  kind: SeatKind;
  /** The anchor it sits on (`anchors.ts`): `pad:orange`, `rim:teal`, `deciding:<id>`, `cloud:orange`. */
  anchor: string;
  /** Its place among the avatars on the same anchor, in join order, and how many there are. */
  slot: number;
  of: number;
  /** Disconnected: shown asleep where they were. */
  asleep: boolean;
};

/** The anchors' names, for whatever registers them. */
export const stageAnchor = {
  pad: (team: Team) => `pad:${team}`,
  rim: (team: Team) => `rim:${team}`,
  cloud: (team: Team) => `cloud:${team}`,
  deciding: (playerId: PlayerId) => `deciding:${playerId}`,
  /** Not seats: where the powers' acts aim (`show.ts`). */
  tower: (team: Team) => `tower:${team}`,
  board: (team: Team) => `board:${team}`,
  slots: (team: Team) => `slots:${team}`,
};

function anchorKey(kind: SeatKind, team: Team, playerId: PlayerId): string {
  return kind === 'deciding' ? stageAnchor.deciding(playerId) : stageAnchor[kind](team);
}

/**
 * Everyone's seat. `has` says which anchors are on screen: a seat whose anchor isn't (the other
 * crew has no decide card on your screen; a placer's cloud waits for the piece to show) falls back
 * to the rim, and a player with no rim on screen isn't seated at all.
 */
export function seatsOf(view: RoomView, has: (anchor: string) => boolean): Seat[] {
  if (view.phase !== 'playing') return [];
  const deciders = new Set(view.deciding.map((d) => d.deciderId));
  const placed: Omit<Seat, 'slot' | 'of'>[] = [];
  for (const team of TEAMS) {
    const crew = view.crews[team];
    for (const p of view.players) {
      if (p.team !== team) continue;
      // Placing comes first: it's what they're doing with their hands.
      let kind: SeatKind =
        crew.placing?.placerId === p.id
          ? 'cloud'
          : crew.round?.drawerId === p.id
            ? 'pad'
            : deciders.has(p.id)
              ? 'deciding'
              : 'rim';
      let anchor = anchorKey(kind, team, p.id);
      if (kind !== 'rim' && !has(anchor)) {
        kind = 'rim';
        anchor = anchorKey(kind, team, p.id);
      }
      if (!has(anchor)) continue;
      placed.push({
        playerId: p.id,
        avatar: p.avatar,
        team,
        kind,
        anchor,
        asleep: !p.connected,
      });
    }
  }
  const counts = new Map<string, number>();
  for (const s of placed) counts.set(s.anchor, (counts.get(s.anchor) ?? 0) + 1);
  const next = new Map<string, number>();
  return placed.map((s) => {
    const slot = next.get(s.anchor) ?? 0;
    next.set(s.anchor, slot + 1);
    return { ...s, slot, of: counts.get(s.anchor) ?? 1 };
  });
}
