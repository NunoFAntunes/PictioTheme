import { STAR_TUNING, TEAMS, type Team } from '@pictiotheme/protocol/tower';
import { cancel, schedule, sendToAll } from './output';
import { grantCharge } from './spells';
import type { Ctx } from './types';

/**
 * Sky stars (docs/tower/planning/power-ups.md): every so often a star appears above each tower's
 * top, at the same place relative to each tower's top, so never inside a tower. They take turns
 * between over the platform and just past its edge (only an overhang reaches those). A settled
 * piece of the tower that touches it for `holdMs` catches it, and the crew gets a spell. The physics says
 * whether it's touched, with each height report.
 */

const playing = (c: Ctx) => (c.state.phase === 'playing' ? c.state.match : null);

const between = ([lo, hi]: readonly [number, number], r: number) => lo + (hi - lo) * r;

export function scheduleStars(c: Ctx, first = false): void {
  schedule(c, 'stars', c.now + (first ? STAR_TUNING.firstMs : STAR_TUNING.everyMs));
}

/** Time for new stars: one for each tower that has none. */
export function onStarsTimer(c: Ctx): void {
  const m = playing(c);
  if (!m) return;
  scheduleStars(c);
  if (!c.state.settings.powers) return;
  const inside = m.starTurns++ % 2 === 0;
  const side = c.rng() < 0.5 ? -1 : 1;
  const x = side * between(inside ? STAR_TUNING.insideX : STAR_TUNING.outsideX, c.rng());
  const dy = between(STAR_TUNING.y, c.rng());
  for (const team of TEAMS) {
    const crew = m.crews[team];
    if (crew.star) continue;
    crew.star = { x, y: crew.height + dy, expiresAt: c.now + STAR_TUNING.lifeMs, holdUntil: null };
    c.fx.push({
      kind: 'physics',
      tower: team,
      physics: { op: 'star', x, y: crew.star.y, radius: STAR_TUNING.radius },
    });
    schedule(c, `star:${team}`, crew.star.expiresAt);
    sendToAll(c, { t: 'crew:star', team, star: crew.star });
  }
}

/** From a height report: a piece of the tower started or stopped touching its star. */
export function onStarTouch(c: Ctx, team: Team, held: boolean): void {
  const crew = playing(c)?.crews[team];
  const star = crew?.star;
  if (!star) return;
  if (held && star.holdUntil === null) {
    star.holdUntil = c.now + STAR_TUNING.holdMs;
    schedule(c, `star:${team}`, star.holdUntil);
  } else if (!held && star.holdUntil !== null) {
    star.holdUntil = null;
    schedule(c, `star:${team}`, star.expiresAt);
  } else {
    return;
  }
  sendToAll(c, { t: 'crew:star', team, star });
}

/** The star was held long enough (a hold that started in time can finish late), or it's gone. */
export function onStarTimer(c: Ctx, team: Team): void {
  const star = playing(c)?.crews[team].star;
  if (!star) return;
  if (star.holdUntil !== null && c.now >= star.holdUntil) removeStar(c, team, true);
  else if (star.holdUntil === null && c.now >= star.expiresAt) removeStar(c, team, false);
}

function removeStar(c: Ctx, team: Team, caught: boolean): void {
  const crew = playing(c)?.crews[team];
  if (!crew?.star) return;
  crew.star = null;
  cancel(c, `star:${team}`);
  c.fx.push({ kind: 'physics', tower: team, physics: { op: 'unstar' } });
  sendToAll(c, { t: 'crew:star', team, star: null, caught });
  if (caught) grantCharge(c, team, 'star');
}
