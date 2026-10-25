import type { PlayerId } from '@pictiotheme/protocol';
import { TEAMS, type Spell, type SpellReason, type Team } from '@pictiotheme/protocol/tower';
import type { RoomView } from '../../realtime';
import { CURSE_LABEL } from '../../lib/curses';
import { SPELL_LABEL } from '../../lib/spells';

/**
 * What the crews' avatars act out for the powers (docs/tower/design/screens.md#the-crews-on-stage),
 * read from the room's events: a spell lobbed at the other tower, a curse hurled over, a thief's
 * dash, a spell flying into its slot; and the crews' reactions to a solve, a steal, a fumble.
 * Pure: the view and the clock in, the new acts out.
 */

export type Act =
  /** `by` throws `icon` at `target`'s tower, landing in `landInMs` (when it takes effect). */
  | {
      kind: 'throw';
      what: 'spell' | 'curse';
      by: PlayerId;
      team: Team;
      target: Team;
      icon: string;
      color: string;
      landInMs: number;
    }
  /** `by` dashes to `robbed`'s drawing and back with it. */
  | { kind: 'steal'; by: PlayerId; team: Team; robbed: Team }
  /** `team` got `spell`: it flies into their slots. */
  | { kind: 'gained'; team: Team; spell: Spell; icon: string; reason: SpellReason }
  /** Reactions (`reactions.ts`): `team` cheers (their drawing was guessed), jumps (it was stolen), or gets rained on (a piece fell off their tower). */
  | { kind: 'cheer' | 'startle' | 'rain'; team: Team };

const other = (team: Team): Team => (team === 'orange' ? 'teal' : 'orange');

/** Each spell's orb colour. */
const SPELL_COLOR: Record<Spell, string> = {
  fog: '#dfe7f2',
  magpie: '#3a3f5c',
  shaky: '#b27cf0',
  pigeon: '#9aa5b1',
};
const CURSE_COLOR = '#8f4cf0';

/** A throw is in the air at least this long, at most this long. */
const MIN_FLIGHT_MS = 650;
const MAX_FLIGHT_MS = 2200;
const CURSE_FLIGHT_MS = 850;

/** The newest event key in `view`, to start reading after (nothing from before is replayed). */
export function lastEventKey(view: RoomView): number {
  return view.events.at(-1)?.key ?? 0;
}

/** The acts for the events after `afterKey`. `serverNow` times a spell's orb to its start. */
export function actsAfter(view: RoomView, afterKey: number, serverNow: number): Act[] {
  if (view.phase !== 'playing') return [];
  const acts: Act[] = [];
  for (const e of view.events) {
    if (e.key <= afterKey) continue;
    if (e.kind === 'cast' && e.playerId && e.spell) {
      const spell = view.crews[e.team].spell;
      const startsIn = spell?.spell === e.spell ? spell.startsAt - serverNow : MIN_FLIGHT_MS;
      acts.push({
        kind: 'throw',
        what: 'spell',
        by: e.playerId,
        team: other(e.team),
        target: e.team,
        icon: SPELL_LABEL[e.spell].icon,
        color: SPELL_COLOR[e.spell],
        landInMs: Math.min(MAX_FLIGHT_MS, Math.max(MIN_FLIGHT_MS, startsIn)),
      });
    } else if (e.kind === 'sent' && e.playerId) {
      acts.push({
        kind: 'throw',
        what: 'curse',
        by: e.playerId,
        team: other(e.team),
        target: e.team,
        icon: ['🌀', ...(e.curses ?? []).map((c) => CURSE_LABEL[c].icon)].join(''),
        color: CURSE_COLOR,
        landInMs: CURSE_FLIGHT_MS,
      });
    } else if (e.kind === 'stolen' && e.playerId) {
      acts.push({ kind: 'steal', by: e.playerId, team: other(e.team), robbed: e.team });
      acts.push({ kind: 'startle', team: e.team });
    } else if (e.kind === 'solved') {
      acts.push({ kind: 'cheer', team: e.team });
    } else if (e.kind === 'fumble') {
      acts.push({ kind: 'rain', team: e.team });
    } else if (e.kind === 'gained' && e.spell && e.reason) {
      acts.push({
        kind: 'gained',
        team: e.team,
        spell: e.spell,
        icon: SPELL_LABEL[e.spell].icon,
        reason: e.reason,
      });
    }
  }
  return acts;
}

/** The drawers shivering under a Shaky hand cast at their crew. */
export function shivering(view: RoomView, serverNow: number): Set<PlayerId> {
  const ids = new Set<PlayerId>();
  for (const team of TEAMS) {
    const crew = view.crews[team];
    const spell = crew.spell;
    if (spell?.spell !== 'shaky' || serverNow < spell.startsAt || serverNow >= spell.endsAt)
      continue;
    if (crew.round) ids.add(crew.round.drawerId);
  }
  return ids;
}
