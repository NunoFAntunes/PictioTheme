import { bloat, DEFAULT_SHAPE_CONFIG, makePiece } from '@pictiotheme/doodle-shape';
import {
  buildMask,
  classifyGuess,
  maskProfanity,
  maxHints,
  pickHintIndex,
  prepareCard,
  shuffle,
} from '@pictiotheme/game-core';
import type { Card, PlayerId } from '@pictiotheme/protocol';
import {
  curseEffects,
  type Curse,
  LINE_HEIGHTS,
  SPELL_TUNING,
  TEAMS,
  TOWER_MIN_PER_CREW,
  type MatchResults,
  type PieceChoice,
  type RoundEndOutcome,
  type Spell,
  type Team,
  type TowerAward,
} from '@pictiotheme/protocol/tower';
import { addBots, botDropX, isBot, isTestRoom, rectangleStrokes } from './bots';
import { activeCurses, rollCurses } from './curses';
import { checkBehind, comeback, grantCharge, rollGolden } from './spells';
import { onStarTouch, scheduleStars } from './stars';
import { cancel, connectedIds, crewIds, schedule, send, sendError, sendToAll } from './output';
import {
  emptyStats,
  otherTeam,
  SPAWN_GAP,
  TIMINGS,
  type Crew,
  type Ctx,
  type Match,
  type MatchEndReason,
  type PieceState,
  type Round,
} from './types';
import { decidingOf, pieceView, roundView, snapshotFor } from './views';

/**
 * A match (docs/tower/product/game-rules.md): both crews' rounds run side by side and nonstop;
 * a solved drawing becomes a piece, its drawer keeps it or curses it and sends it, and the crew
 * whose tower it's for places it. The first tower to stay above the line for 3s wins.
 */

/**
 * Each crew's drawing shows this many hint letters at most, at a third and two thirds of the
 * round. Before the first, the crew doesn't even see the mask: the drawer draws first.
 */
const MAX_HINTS = 2;

const lineHeight = (c: Ctx) => LINE_HEIGHTS[c.state.settings.line];

function match(c: Ctx): Match | null {
  return c.state.phase === 'playing' ? c.state.match : null;
}

/** Crew members in join order. */
function members(c: Ctx, team: Team) {
  return [...c.state.players.values()].filter((p) => p.team === team);
}

// ── Start and end ────────────────────────────────────────────────────────────

export function canStart(c: Ctx): string | null {
  // Bots fill the crews (bots.ts): anyone can try the powers alone.
  if (isTestRoom(c))
    return crewIds(c, 'orange').length + crewIds(c, 'teal').length > 0 ? null : 'Join a crew';
  for (const team of TEAMS) {
    if (crewIds(c, team).length < TOWER_MIN_PER_CREW) {
      return `Each crew needs at least ${TOWER_MIN_PER_CREW} players`;
    }
  }
  if (Math.abs(crewIds(c, 'orange').length - crewIds(c, 'teal').length) > 1) {
    return 'The crews can differ by one player at most';
  }
  return null;
}

function newCrew(team: Team): Crew {
  return {
    team,
    round: null,
    lastDrawerId: null,
    queue: [],
    placing: null,
    daze: null,
    height: 0,
    sentHeight: 0,
    toppingSince: null,
    charges: [],
    spell: null,
    lastGolden: false,
    behindSince: null,
    comebackAt: null,
    star: null,
  };
}

export function startMatch(c: Ctx): void {
  const { state } = c;
  const words = state.words ?? [];
  if (isTestRoom(c)) addBots(c);
  state.match = {
    startedAt: c.now,
    endsAt: c.now + TIMINGS.matchMs,
    crews: { orange: newCrew('orange'), teal: newCrew('teal') },
    pieces: new Map(),
    nextPieceId: 1,
    nextRoundId: 1,
    pool: shuffle(words, c.rng),
    used: [],
  };
  state.phase = 'playing';
  state.results = null;
  for (const p of state.players.values()) p.stats = emptyStats();
  cancel(c, 'idle');
  schedule(c, 'match', state.match.endsAt);
  scheduleStars(c, true);
  for (const team of TEAMS) {
    c.fx.push({ kind: 'physics', tower: team, physics: { op: 'reset', line: lineHeight(c) } });
    startRound(c, team, false);
  }
  for (const id of connectedIds(c)) send(c, id, snapshotFor(state, id, c.now));
}

function awards(c: Ctx): TowerAward[] {
  const players = [...c.state.players.values()].filter((p) => p.team);
  const top = (kind: TowerAward['kind'], score: (s: (typeof players)[number]) => number | null) => {
    let best: { id: PlayerId; value: number } | null = null;
    for (const p of players) {
      const value = score(p);
      if (value !== null && value > 0 && (!best || value > best.value)) best = { id: p.id, value };
    }
    return best ? [{ kind, playerId: best.id }] : [];
  };
  return [
    ...top('best_thief', (p) => p.stats.steals),
    ...top('meanest_curser', (p) => p.stats.curses),
    ...top('master_builder', (p) => p.stats.placements),
    // Quickest: the smallest time wins, so score by its inverse.
    ...top('quickest_guesser', (p) =>
      p.stats.fastestSolveMs === null ? null : 1 / (1 + p.stats.fastestSolveMs),
    ),
  ];
}

export function finishMatch(c: Ctx, winner: Team | null, reason: MatchEndReason): void {
  const m = match(c);
  if (!m) return;
  const { state } = c;
  for (const team of TEAMS) {
    for (const t of ['round', 'hint', 'place', 'daze', 'topping', 'spell', 'star'] as const)
      cancel(c, `${t}:${team}`);
    c.fx.push({ kind: 'physics', tower: team, physics: { op: 'stop' } });
    m.crews[team].round = null;
  }
  for (const piece of m.pieces.values()) {
    if (piece.decideBy !== null) {
      cancel(c, `decide:${piece.id}`);
      piece.decideBy = null;
    }
  }
  cancel(c, 'match');
  cancel(c, 'stars');
  const results: MatchResults = {
    winner,
    reason,
    heights: { orange: m.crews.orange.height, teal: m.crews.teal.height },
    players: [...state.players.values()].flatMap((p) =>
      p.team
        ? [
            {
              id: p.id,
              name: p.name,
              team: p.team,
              drawings: p.stats.drawings,
              solves: p.stats.solves,
              steals: p.stats.steals,
              curses: p.stats.curses,
              placements: p.stats.placements,
              fumbles: p.stats.fumbles,
            },
          ]
        : [],
    ),
    awards: awards(c),
  };
  state.phase = 'results';
  state.results = results;
  sendToAll(c, { t: 'match:end', results });
  c.fx.push({ kind: 'matchEnded', results, startedAt: m.startedAt, endedAt: c.now });
  schedule(c, 'idle', c.now + TIMINGS.idleMs);
}

export function onMatchTimer(c: Ctx): void {
  const m = match(c);
  if (!m) return;
  const { orange, teal } = m.crews;
  const diff = orange.height - teal.height;
  finishMatch(c, Math.abs(diff) < 0.01 ? null : diff > 0 ? 'orange' : 'teal', 'time');
}

// ── Rounds ───────────────────────────────────────────────────────────────────

/**
 * The next drawer after the last one, in join order: connected, and not placing a piece (a crew
 * of two would otherwise stall: its only guesser can't draw and place at once).
 */
function nextDrawer(c: Ctx, crew: Crew): PlayerId | null {
  // In test mode only the drawer bots draw: the people guess, decide, place and cast.
  const list = members(c, crew.team).filter((p) => !isTestRoom(c) || p.bot === 'drawer');
  if (list.length === 0) return null;
  const start = crew.lastDrawerId ? list.findIndex((p) => p.id === crew.lastDrawerId) : -1;
  for (let k = 1; k <= list.length; k++) {
    const p = list[(start + k + list.length) % list.length];
    if (p?.connected && crew.placing?.placerId !== p.id) return p.id;
  }
  return null;
}

/**
 * The next card that can't be mistaken for the other crew's current word: a guess that's right
 * for both would solve both drawings. Used cards come back once the pool runs out.
 */
function dealCard(c: Ctx, m: Match, team: Team): Card | null {
  const other = m.crews[otherTeam(team)].round;
  const clashes = (card: Card) =>
    other !== null &&
    (classifyGuess(other.prepared, card.text) === 'correct' ||
      classifyGuess(prepareCard(card), other.card.text) === 'correct');
  for (let pass = 0; pass < 2; pass++) {
    const index = m.pool.findIndex((card) => !clashes(card));
    if (index >= 0) {
      const [card] = m.pool.splice(index, 1);
      if (card) m.used.push(card);
      return card ?? null;
    }
    if (m.used.length === 0) return null;
    const inPlay = new Set(TEAMS.map((t) => m.crews[t].round?.card.text));
    m.pool = shuffle(
      m.used.filter((card) => !inPlay.has(card.text)),
      c.rng,
    );
    m.used = m.used.filter((card) => inPlay.has(card.text));
  }
  return null;
}

/** Sends a crew's new round to everyone: the word to the drawer, the mask to the crew. */
export function announceRound(c: Ctx, team: Team, round: Round): void {
  for (const id of [...c.state.players.values()].filter((p) => p.connected).map((p) => p.id)) {
    send(c, id, { t: 'round:start', team, round: roundView(c.state, team, round, id) });
  }
}

/** Deals the crew a new word and a new drawer. No-op (round stays null) if nobody can draw. */
export function startRound(c: Ctx, team: Team, announce = true): void {
  const m = match(c);
  if (!m) return;
  const crew = m.crews[team];
  crew.round = null;
  const drawerId = nextDrawer(c, crew);
  const card = drawerId ? dealCard(c, m, team) : null;
  if (!drawerId || !card) return;
  const roundMs = c.state.settings.roundSeconds * 1000;
  const round: Round = {
    id: m.nextRoundId++,
    drawerId,
    card,
    prepared: prepareCard(card),
    startedAt: c.now,
    endsAt: c.now + roundMs,
    maskShown: false,
    revealed: new Set(),
    golden: rollGolden(c, crew),
    shaky: new Set(),
    nextHintAt: c.now + roundMs / (MAX_HINTS + 1),
    strokes: [],
    redo: [],
    points: 0,
  };
  if (isTestRoom(c)) {
    const spell = crew.spell;
    const shaky = spell?.spell === 'shaky' && c.now >= spell.startsAt && c.now < spell.endsAt;
    round.strokes = rectangleStrokes(c.rng, round.id, shaky);
  }
  crew.round = round;
  crew.lastDrawerId = drawerId;
  const drawer = c.state.players.get(drawerId);
  if (drawer) drawer.stats.drawings += 1;
  schedule(c, `round:${team}`, round.endsAt);
  schedule(c, `hint:${team}`, round.nextHintAt ?? round.endsAt);
  if (announce) announceRound(c, team, round);
}

function endRound(
  c: Ctx,
  team: Team,
  outcome: RoundEndOutcome,
  extra: { solverId?: PlayerId; pieceId?: number } = {},
): void {
  const crew = match(c)?.crews[team];
  const round = crew?.round;
  if (!crew || !round) return;
  cancel(c, `round:${team}`);
  cancel(c, `hint:${team}`);
  crew.round = null;
  sendToAll(c, {
    t: 'round:end',
    team,
    roundId: round.id,
    outcome,
    word: round.card.text,
    ...extra,
  });
}

export function onRoundTimer(c: Ctx, team: Team): void {
  if (!match(c)?.crews[team].round) return;
  endRound(c, team, 'expired');
  startRound(c, team);
}

export function onHintTimer(c: Ctx, team: Team): void {
  const round = match(c)?.crews[team].round;
  if (!round) return;
  const total = Math.min(MAX_HINTS, maxHints(round.card.text));
  round.maskShown = true;
  if (round.revealed.size < total) {
    const index = pickHintIndex(round.card.text, round.revealed, c.rng);
    if (index !== null) round.revealed.add(index);
  }
  send(c, crewIds(c, team), {
    t: 'round:hint',
    team,
    roundId: round.id,
    mask: buildMask(round.card.text, round.revealed),
  });
  if (round.revealed.size < total) {
    const roundMs = round.endsAt - round.startedAt;
    round.nextHintAt = round.startedAt + (roundMs * (round.revealed.size + 1)) / (MAX_HINTS + 1);
    schedule(c, `hint:${team}`, round.nextHintAt);
  } else {
    round.nextHintAt = null;
  }
}

/** The drawer left: their crew's drawing ends with no piece, and the next one starts. */
export function onDrawerLeft(c: Ctx, playerId: PlayerId): void {
  const m = match(c);
  if (!m) return;
  for (const team of TEAMS) {
    if (m.crews[team].round?.drawerId === playerId) {
      endRound(c, team, 'drawer_left');
      startRound(c, team);
    }
  }
}

/** Crews that have no round (nobody could draw) get one when someone becomes free. */
export function resumeIdleCrews(c: Ctx): void {
  const m = match(c);
  if (!m) return;
  for (const team of TEAMS) if (!m.crews[team].round) startRound(c, team);
}

// ── Guessing ─────────────────────────────────────────────────────────────────

export function onGuess(c: Ctx, playerId: PlayerId, text: string): void {
  const m = match(c);
  const player = c.state.players.get(playerId);
  if (!m || !player?.team) {
    sendError(c, playerId, 'WRONG_PHASE', 'There is nothing to guess right now');
    return;
  }
  const own = m.crews[player.team];
  if (own.round?.drawerId === playerId) {
    sendError(c, playerId, 'NOT_DRAWER', "The drawer can't guess");
    return;
  }
  if (own.placing?.placerId === playerId) {
    sendError(c, playerId, 'WRONG_PHASE', 'Place your piece first');
    return;
  }
  const rival = otherTeam(player.team);
  const stealable = c.state.settings.steals ? m.crews[rival].round : null;
  if (!own.round && !stealable) {
    sendError(c, playerId, 'WRONG_PHASE', 'There is no drawing right now');
    return;
  }
  const teammates = crewIds(c, player.team).filter((id) => id !== playerId);
  const solved = (team: Team, round: Round, target: 'own' | 'steal') => {
    send(c, playerId, { t: 'guess:result', target, text, result: 'correct' });
    send(c, teammates, { t: 'crew:feed', playerId, target, solved: true });
    solveRound(c, team, playerId, round, target === 'steal');
  };

  // One guess line for both drawings: your crew's first, then the other crew's (a steal, which
  // gets no "so close": that help is for the home crew).
  const home = own.round ? classifyGuess(own.round.prepared, text) : 'wrong';
  if (home === 'correct' && own.round) return solved(player.team, own.round, 'own');
  if (stealable && classifyGuess(stealable.prepared, text) === 'correct') {
    return solved(rival, stealable, 'steal');
  }
  send(c, playerId, { t: 'guess:result', target: 'own', text, result: home });
  // Close guesses aren't shown to teammates: they'd give the answer away to nobody useful.
  if (home === 'wrong') {
    send(c, teammates, { t: 'crew:feed', playerId, target: 'own', text: maskProfanity(text) });
  }
}

/** The drawing after its last clear: what the piece is made from and drawn with. */
function visibleStrokes(round: Round) {
  const lastClear = round.strokes.findLastIndex((s) => s.tool === 'clear');
  return round.strokes
    .slice(lastClear + 1)
    .map((s) => ('pts' in s ? { ...s, pts: [...s.pts] } : { ...s }));
}

/**
 * Turns a solved drawing into a piece, for its decider to keep or curse. Test mode can choose the
 * curse (`curse`), and its solver always decides (the drawer is a bot). Returns the piece.
 */
export function solveRound(
  c: Ctx,
  team: Team,
  solverId: PlayerId,
  round: Round,
  stolen: boolean,
  curse?: Curse,
): PieceState | null {
  const m = match(c);
  const solver = c.state.players.get(solverId);
  if (!m || !solver) return null;
  solver.stats.solves += 1;
  if (stolen) solver.stats.steals += 1;
  const took = c.now - round.startedAt;
  solver.stats.fastestSolveMs = Math.min(solver.stats.fastestSolveMs ?? took, took);
  // A golden word's spell goes to the solver's crew: the thief's, for a steal.
  if (round.golden && solver.team) grantCharge(c, solver.team, 'golden');

  const strokes = visibleStrokes(round);
  const made = makePiece(strokes);
  if (!made.ok) {
    endRound(c, team, 'blank', { solverId });
    startRound(c, team);
    return null;
  }
  const powers = c.state.settings.powers;
  const piece: PieceState = {
    id: m.nextPieceId++,
    word: round.card.text,
    team,
    drawnBy: round.drawerId,
    solvedBy: solverId,
    // The drawer chooses, and places it if they keep it, while the solver starts drawing. A
    // stolen piece is the thief's: the drawer is on the other crew.
    deciderId: stolen || isTestRoom(c) ? solverId : round.drawerId,
    stolen,
    tower: null,
    sent: false,
    curses: powers ? (curse ? [curse] : rollCurses(c.rng, round.golden)) : [],
    fumbled: false,
    shape: {
      ...made.piece,
      silhouette: made.preview.silhouette,
      cell: made.preview.frame.cell,
    },
    strokes,
    decideBy: c.now + TIMINGS.decideMs,
    placedBy: null,
  };
  m.pieces.set(piece.id, piece);
  schedule(c, `decide:${piece.id}`, piece.decideBy ?? c.now);
  endRound(c, team, stolen ? 'stolen' : 'solved', { solverId, pieceId: piece.id });
  const deciding = decidingOf(piece);
  if (deciding) sendToAll(c, { t: 'piece:made', piece: pieceView(piece), deciding });
  startRound(c, team);
  return piece;
}

// ── Keep or Curse ───────────────────────────────────────────────────────────

export function onDecide(c: Ctx, playerId: PlayerId, pieceId: number, choice: PieceChoice): void {
  const piece = match(c)?.pieces.get(pieceId);
  if (!piece || piece.decideBy === null) return; // already decided (or timed out): ignore quietly
  if (piece.deciderId !== playerId) {
    sendError(c, playerId, 'FORBIDDEN', 'Only the drawer (or the thief) decides');
    return;
  }
  decide(c, piece, choice);
}

export function onDecideTimer(c: Ctx, pieceId: number): void {
  const piece = match(c)?.pieces.get(pieceId);
  if (piece && piece.decideBy !== null) decide(c, piece, 'keep');
}

/** The decider's crew: the drawing's crew, or the other one for a steal. */
const deciderTeamOf = (piece: PieceState): Team =>
  piece.stolen ? otherTeam(piece.team) : piece.team;

/** A piece this player is choosing for, if they just left: it's kept. */
export function onDeciderLeft(c: Ctx, playerId: PlayerId): void {
  const m = match(c);
  if (!m) return;
  for (const piece of m.pieces.values()) {
    if (piece.decideBy !== null && piece.deciderId === playerId) decide(c, piece, 'keep');
  }
}

export function decide(c: Ctx, piece: PieceState, choice: PieceChoice): void {
  const m = match(c);
  if (!m) return;
  cancel(c, `decide:${piece.id}`);
  piece.decideBy = null;
  const deciderTeam = deciderTeamOf(piece);
  const tower = choice === 'keep' ? deciderTeam : otherTeam(deciderTeam);
  piece.tower = tower;
  piece.sent = choice === 'curse';
  const decider = c.state.players.get(piece.deciderId);
  if (piece.sent && decider) decider.stats.curses += 1;
  const curse = curseEffects(activeCurses(piece));
  if (curse.melt) {
    // Melted from the drawing again: the drooping happens on the cells, before tracing.
    const made = makePiece(piece.strokes, DEFAULT_SHAPE_CONFIG, undefined, { melt: true });
    if (made.ok) {
      piece.shape = {
        ...made.piece,
        silhouette: made.preview.silhouette,
        cell: made.preview.frame.cell,
      };
    }
  }
  if (curse.bloat !== null) piece.shape = bloat(piece.shape, curse.bloat);
  const reshaped = curse.melt || curse.bloat !== null;
  // A kept piece is placed by its decider if they're free; a cursed one by the receiving crew.
  m.crews[tower].queue.push({ pieceId: piece.id, placer: piece.sent ? null : piece.deciderId });
  sendToAll(c, {
    t: 'piece:queued',
    pieceId: piece.id,
    tower,
    sent: piece.sent,
    ...(reshaped && { shape: piece.shape }),
  });
  if (!magpieSnatch(c, tower)) tryStartPlacement(c, tower);
}

// ── Spells ───────────────────────────────────────────────────────────────────

/**
 * Casts the crew's spell in `slot` at the other crew's tower (docs/tower/planning/power-ups.md):
 * anyone in the crew but its drawer, one spell per tower at a time, after a warning.
 */
export function onCast(c: Ctx, playerId: PlayerId, slot: number): void {
  const m = match(c);
  const player = c.state.players.get(playerId);
  if (!m || !player?.team) {
    sendError(c, playerId, 'WRONG_PHASE', 'There is nothing to cast at right now');
    return;
  }
  const own = m.crews[player.team];
  if (own.round?.drawerId === playerId) {
    sendError(c, playerId, 'NOT_DRAWER', "The drawer can't cast spells");
    return;
  }
  const spell = own.charges[slot];
  if (!spell) {
    sendError(c, playerId, 'WRONG_PHASE', 'There is no spell there');
    return;
  }
  const target = otherTeam(player.team);
  const crew = m.crews[target];
  if (crew.spell) {
    sendError(c, playerId, 'WRONG_PHASE', 'Their tower is already under a spell');
    return;
  }
  own.charges.splice(slot, 1);
  const startsAt = c.now + SPELL_TUNING.warnMs;
  crew.spell = {
    spell,
    casterId: playerId,
    startsAt,
    endsAt: startsAt + SPELL_MS[spell],
  };
  schedule(c, `spell:${target}`, startsAt);
  sendToAll(c, { t: 'crew:charges', team: player.team, charges: own.charges });
  sendToAll(c, { t: 'crew:spell', team: target, spell: crew.spell });
}

const SPELL_MS: Record<Spell, number> = {
  fog: SPELL_TUNING.fogMs,
  magpie: SPELL_TUNING.magpieMs,
  shaky: SPELL_TUNING.shakyMs,
  pigeon: SPELL_TUNING.pigeonMs,
};

function endSpell(c: Ctx, team: Team): void {
  const crew = match(c)?.crews[team];
  if (!crew?.spell) return;
  cancel(c, `spell:${team}`);
  if (crew.spell.spell === 'pigeon') {
    c.fx.push({ kind: 'physics', tower: team, physics: { op: 'unpigeon' } });
  }
  crew.spell = null;
  sendToAll(c, { t: 'crew:spell', team, spell: null });
}

/** The warning is over (the spell starts), or the spell is. */
export function onSpellTimer(c: Ctx, team: Team): void {
  const spell = match(c)?.crews[team].spell;
  if (!spell) return;
  if (c.now >= spell.endsAt) {
    endSpell(c, team);
    return;
  }
  if (spell.spell === 'magpie' && magpieSnatch(c, team)) return;
  if (spell.spell === 'pigeon') {
    const side = c.rng() < 0.5 ? -1 : 1;
    c.fx.push({ kind: 'physics', tower: team, physics: { op: 'pigeon', side } });
  }
  schedule(c, `spell:${team}`, spell.endsAt);
}

/** The pigeon left on its own (scared away by a new piece, or fallen): the spell is over. */
export function onPigeonGone(c: Ctx, team: Team): void {
  if (match(c)?.crews[team].spell?.spell === 'pigeon') endSpell(c, team);
}

/**
 * A magpie on this crew's tower takes the next piece in its queue, if there is one, into the
 * caster's crew's queue for the caster to place. True if it took one (the spell is then over).
 */
function magpieSnatch(c: Ctx, team: Team): boolean {
  const m = match(c);
  const crew = m?.crews[team];
  const spell = crew?.spell;
  if (!m || !crew || spell?.spell !== 'magpie' || c.now < spell.startsAt) return false;
  const entry = crew.queue.shift();
  const piece = entry ? m.pieces.get(entry.pieceId) : undefined;
  if (!piece) return false;
  const to = otherTeam(team);
  piece.tower = to;
  m.crews[to].queue.push({ pieceId: piece.id, placer: spell.casterId });
  sendToAll(c, { t: 'piece:magpied', pieceId: piece.id, from: team, to, casterId: spell.casterId });
  endSpell(c, team);
  tryStartPlacement(c, to);
  tryStartPlacement(c, team);
  return true;
}

// ── Placing ──────────────────────────────────────────────────────────────────

/**
 * Who places the next piece: the preferred player if they're free, otherwise the free guesser
 * with the fewest placements this match (join order breaks ties). The drawer never places.
 */
function choosePlacer(c: Ctx, crew: Crew, preferred: PlayerId | null): PlayerId | null {
  const free = members(c, crew.team).filter(
    (p) => p.connected && p.id !== crew.round?.drawerId && p.bot !== 'drawer',
  );
  if (preferred && free.some((p) => p.id === preferred)) return preferred;
  let best: (typeof free)[number] | null = null;
  for (const p of free) {
    if (!best || p.stats.placements < best.stats.placements) best = p;
  }
  return best?.id ?? null;
}

export function tryStartPlacement(c: Ctx, team: Team): void {
  const m = match(c);
  if (!m) return;
  const crew = m.crews[team];
  if (crew.placing || crew.queue.length === 0) return;
  if (crew.daze && c.now < crew.daze.until) return;
  const next = crew.queue[0];
  const piece = next ? m.pieces.get(next.pieceId) : undefined;
  if (!next || !piece) {
    crew.queue.shift();
    return;
  }
  const placerId = choosePlacer(c, crew, next.placer);
  if (!placerId) return;
  crew.queue.shift();
  const curse = curseEffects(activeCurses(piece));
  crew.placing = {
    pieceId: piece.id,
    placerId,
    endsAt: c.now + TIMINGS.placeMs,
  };
  piece.placedBy = placerId;
  schedule(c, `place:${team}`, crew.placing.endsAt);
  c.fx.push({
    kind: 'physics',
    tower: team,
    physics: {
      op: 'spawn',
      pieceId: piece.id,
      outline: piece.shape.outline,
      parts: piece.shape.parts,
      gap: SPAWN_GAP,
      ...curse.material,
    },
  });
  sendToAll(c, { t: 'place:start', tower: team, placing: crew.placing });
  // A bot steers it over the platform and lets it down quickly.
  if (isBot(c.state.players.get(placerId))) {
    c.fx.push({
      kind: 'physics',
      tower: team,
      physics: { op: 'steer', x: botDropX(c.rng), fast: true },
    });
  }
}

/** The crew whose piece this player is placing, if any. */
export function placingCrew(c: Ctx, playerId: PlayerId): Crew | null {
  const m = match(c);
  if (!m) return null;
  return TEAMS.map((t) => m.crews[t]).find((crew) => crew.placing?.placerId === playerId) ?? null;
}

export function onSteer(
  c: Ctx,
  playerId: PlayerId,
  steer: { x?: number; angle?: number; fast?: boolean },
): void {
  const crew = placingCrew(c, playerId);
  if (!crew) return; // a steer in flight as the piece lands: ignore quietly
  c.fx.push({ kind: 'physics', tower: crew.team, physics: { op: 'steer', ...steer } });
}

export function onDrop(c: Ctx, playerId: PlayerId): void {
  const crew = placingCrew(c, playerId);
  if (crew) c.fx.push({ kind: 'physics', tower: crew.team, physics: { op: 'drop' } });
}

export function onPlaceTimer(c: Ctx, team: Team): void {
  if (match(c)?.crews[team].placing) {
    c.fx.push({ kind: 'physics', tower: team, physics: { op: 'drop' } });
  }
}

function endPlacement(c: Ctx, crew: Crew): void {
  const placing = crew.placing;
  if (!placing) return;
  cancel(c, `place:${crew.team}`);
  crew.placing = null;
  sendToAll(c, { t: 'place:end', tower: crew.team, pieceId: placing.pieceId });
}

export function onReleased(c: Ctx, team: Team, pieceId: number): void {
  const crew = match(c)?.crews[team];
  if (!crew || crew.placing?.pieceId !== pieceId) return;
  const placer = c.state.players.get(crew.placing.placerId);
  if (placer) placer.stats.placements += 1;
  endPlacement(c, crew);
  tryStartPlacement(c, team);
  // The placer is free to draw again.
  resumeIdleCrews(c);
}

/** The placer left: the piece drops where it is. */
export function onPlacerLeft(c: Ctx, playerId: PlayerId): void {
  const crew = placingCrew(c, playerId);
  if (crew) c.fx.push({ kind: 'physics', tower: crew.team, physics: { op: 'drop' } });
}

// ── Fumbles and height ───────────────────────────────────────────────────────

export function onFumbled(c: Ctx, team: Team, pieceIds: number[]): void {
  const m = match(c);
  if (!m) return;
  const crew = m.crews[team];
  for (const id of pieceIds) {
    const piece = m.pieces.get(id);
    if (!piece) continue;
    piece.fumbled = true;
    const placer = piece.placedBy ? c.state.players.get(piece.placedBy) : undefined;
    if (placer) placer.stats.fumbles += 1;
    if (crew.placing?.pieceId === id) endPlacement(c, crew);
  }
  const dazeMs = c.state.settings.dazeSeconds * 1000;
  if (dazeMs > 0) {
    crew.daze =
      crew.daze && c.now < crew.daze.until
        ? {
            since: crew.daze.since,
            until: Math.min(
              crew.daze.since + TIMINGS.dazeMaxMs,
              crew.daze.until + TIMINGS.dazeExtraMs,
            ),
          }
        : { since: c.now, until: c.now + dazeMs };
    schedule(c, `daze:${team}`, crew.daze.until);
  }
  sendToAll(c, { t: 'tower:fumble', tower: team, pieceIds, dazedUntil: crew.daze?.until ?? null });
  comeback(c, team);
  tryStartPlacement(c, team);
}

export function onDazeTimer(c: Ctx, team: Team): void {
  tryStartPlacement(c, team);
}

export function onHeight(c: Ctx, team: Team, height: number, starHeld?: boolean): void {
  const crew = match(c)?.crews[team];
  if (!crew) return;
  crew.height = height;
  checkBehind(c, team);
  if (starHeld !== undefined) onStarTouch(c, team, starHeld);
  let changed = Math.abs(height - crew.sentHeight) >= 0.05;
  if (height >= lineHeight(c)) {
    if (crew.toppingSince === null) {
      crew.toppingSince = c.now;
      schedule(c, `topping:${team}`, c.now + TIMINGS.toppingMs);
      changed = true;
    }
  } else if (crew.toppingSince !== null) {
    crew.toppingSince = null;
    cancel(c, `topping:${team}`);
    changed = true;
  }
  if (!changed) return;
  crew.sentHeight = height;
  sendToAll(c, {
    t: 'tower:height',
    tower: team,
    height,
    toppingUntil: crew.toppingSince === null ? null : crew.toppingSince + TIMINGS.toppingMs,
  });
}

export function onToppingTimer(c: Ctx, team: Team): void {
  const crew = match(c)?.crews[team];
  if (crew?.toppingSince !== null && crew && c.now - crew.toppingSince >= TIMINGS.toppingMs) {
    finishMatch(c, team, 'topped_out');
  }
}
