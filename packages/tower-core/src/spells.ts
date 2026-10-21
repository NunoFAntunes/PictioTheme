import { randomInt } from '@pictiotheme/game-core';
import {
  SPELL_TUNING,
  SPELLS,
  type Spell,
  type SpellReason,
  type Team,
} from '@pictiotheme/protocol/tower';
import { sendToAll } from './output';
import { otherTeam, type Crew, type Ctx } from './types';

/**
 * Earning spells (docs/tower/planning/power-ups.md): golden words and comeback charges (sky stars
 * are in stars.ts). Casting them, which needs the queue and placing, is in match.ts.
 */

const crewOf = (c: Ctx, team: Team): Crew | null =>
  c.state.phase === 'playing' ? (c.state.match?.crews[team] ?? null) : null;

/**
 * Gives the crew a random spell, if powers are on and it has room for one. A crew that's full
 * doesn't get one: use them or lose them.
 */
export function grantCharge(c: Ctx, team: Team, reason: SpellReason): void {
  const crew = crewOf(c, team);
  if (!crew || !c.state.settings.powers || crew.charges.length >= SPELL_TUNING.maxCharges) return;
  const spell = SPELLS[randomInt(c.rng, SPELLS.length)] as Spell;
  crew.charges.push(spell);
  sendToAll(c, { t: 'crew:charges', team, charges: crew.charges, gained: { spell, reason } });
}

/** About one round in `goldenEvery` is golden, never twice in a row for a crew. */
export function rollGolden(c: Ctx, crew: Crew): boolean {
  const golden =
    c.state.settings.powers && !crew.lastGolden && c.rng() < 1 / SPELL_TUNING.goldenEvery;
  crew.lastGolden = golden;
  return golden;
}

/** A comeback charge, unless the crew had one recently. */
export function comeback(c: Ctx, team: Team): void {
  const crew = crewOf(c, team);
  if (!crew) return;
  if (crew.comebackAt !== null && c.now - crew.comebackAt < SPELL_TUNING.comebackCooldownMs) {
    return;
  }
  if (!c.state.settings.powers || crew.charges.length >= SPELL_TUNING.maxCharges) return;
  crew.comebackAt = c.now;
  crew.behindSince = null;
  grantCharge(c, team, 'comeback');
}

/**
 * After a height change: a crew that's been `comebackGap` behind the other for `behindMs` gets a
 * comeback charge. Heights come in about ten times a second, so no timer is needed.
 */
export function checkBehind(c: Ctx, team: Team): void {
  for (const t of [team, otherTeam(team)]) {
    const crew = crewOf(c, t);
    const rival = crewOf(c, otherTeam(t));
    if (!crew || !rival) return;
    if (rival.height - crew.height < SPELL_TUNING.comebackGap) {
      crew.behindSince = null;
    } else if (crew.behindSince === null) {
      crew.behindSince = c.now;
    } else if (c.now - crew.behindSince >= SPELL_TUNING.behindMs) {
      comeback(c, t);
    }
  }
}
