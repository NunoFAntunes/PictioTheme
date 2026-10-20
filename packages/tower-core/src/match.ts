import { makePiece } from '@pictiotheme/doodle-shape';
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
  LINE_HEIGHTS,
  TEAMS,
  TOWER_MIN_PER_CREW,
  type MatchResults,
  type PieceChoice,
  type RoundEndOutcome,
  type Team,
  type TowerAward,
} from '@pictiotheme/protocol/tower';
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
 * a solved drawing becomes a piece, its solver builds with it or sends it, and the crew whose
 * tower it's for places it. The first tower to stay above the line for 3s wins.
 */

/** Each crew's drawing shows this many hint letters at most (at a third and two thirds). */
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
  };
}

export function startMatch(c: Ctx): void {
  const { state } = c;
  const words = state.words ?? [];
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
  for (const p of state.players.values()) {
    p.stats = emptyStats();
    p.stealCooldownUntil = 0;
  }
  cancel(c, 'idle');
  schedule(c, 'match', state.match.endsAt);
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
    ...top('meanest_sender', (p) => p.stats.sends),
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
    for (const t of ['round', 'hint', 'place', 'daze', 'topping'] as const)
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
              sends: p.stats.sends,
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
  const list = members(c, crew.team);
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
function announceRound(c: Ctx, team: Team, round: Round): void {
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
  const hints = Math.min(MAX_HINTS, maxHints(card.text));
  const round: Round = {
    id: m.nextRoundId++,
    drawerId,
    card,
    prepared: prepareCard(card),
    startedAt: c.now,
    endsAt: c.now + roundMs,
    revealed: new Set(),
    nextHintAt: hints > 0 ? c.now + roundMs / (MAX_HINTS + 1) : null,
    strokes: [],
    redo: [],
    points: 0,
  };
  crew.round = round;
  crew.lastDrawerId = drawerId;
  const drawer = c.state.players.get(drawerId);
  if (drawer) drawer.stats.drawings += 1;
  schedule(c, `round:${team}`, round.endsAt);
  if (round.nextHintAt !== null) schedule(c, `hint:${team}`, round.nextHintAt);
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
  const index = pickHintIndex(round.card.text, round.revealed, c.rng);
  if (index !== null) round.revealed.add(index);
  send(c, crewIds(c, team), {
    t: 'round:hint',
    team,
    roundId: round.id,
    mask: buildMask(round.card.text, round.revealed),
  });
  const total = Math.min(MAX_HINTS, maxHints(round.card.text));
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

export function onGuess(c: Ctx, playerId: PlayerId, text: string, target: 'own' | 'steal'): void {
  const m = match(c);
  const player = c.state.players.get(playerId);
  if (!m || !player?.team) {
    sendError(c, playerId, 'WRONG_PHASE', 'There is nothing to guess right now');
    return;
  }
  if (target === 'steal' && !c.state.settings.steals) {
    sendError(c, playerId, 'FORBIDDEN', 'Steals are off in this room');
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
  const team = target === 'own' ? player.team : otherTeam(player.team);
  const round = m.crews[team].round;
  if (!round) {
    sendError(c, playerId, 'WRONG_PHASE', 'That crew has no drawing right now');
    return;
  }
  if (target === 'steal' && c.now < player.stealCooldownUntil) {
    send(c, playerId, {
      t: 'guess:result',
      target,
      text,
      result: 'wrong',
      cooldownUntil: player.stealCooldownUntil,
    });
    return;
  }

  let result = classifyGuess(round.prepared, text);
  // A steal gets no "so close": that help is for the home crew.
  if (target === 'steal' && result === 'close') result = 'wrong';
  const teammates = crewIds(c, player.team).filter((id) => id !== playerId);

  if (result === 'correct') {
    send(c, playerId, { t: 'guess:result', target, text, result });
    send(c, teammates, { t: 'crew:feed', playerId, target, solved: true });
    solveRound(c, team, playerId, round, target === 'steal');
    return;
  }
  if (result === 'wrong' && target === 'steal') {
    player.stealCooldownUntil = c.now + TIMINGS.stealCooldownMs;
  }
  send(c, playerId, {
    t: 'guess:result',
    target,
    text,
    result,
    ...(target === 'steal' && result === 'wrong' && { cooldownUntil: player.stealCooldownUntil }),
  });
  // Close guesses aren't shown to teammates: they'd give the answer away to nobody useful.
  if (result === 'wrong') {
    send(c, teammates, { t: 'crew:feed', playerId, target, text: maskProfanity(text) });
  }
}

/** The drawing after its last clear: what the piece is made from and drawn with. */
function visibleStrokes(round: Round) {
  const lastClear = round.strokes.findLastIndex((s) => s.tool === 'clear');
  return round.strokes
    .slice(lastClear + 1)
    .map((s) => ('pts' in s ? { ...s, pts: [...s.pts] } : { ...s }));
}

function solveRound(c: Ctx, team: Team, solverId: PlayerId, round: Round, stolen: boolean): void {
  const m = match(c);
  const solver = c.state.players.get(solverId);
  if (!m || !solver) return;
  solver.stats.solves += 1;
  if (stolen) solver.stats.steals += 1;
  const took = c.now - round.startedAt;
  solver.stats.fastestSolveMs = Math.min(solver.stats.fastestSolveMs ?? took, took);

  const strokes = visibleStrokes(round);
  const made = makePiece(strokes);
  if (!made.ok) {
    endRound(c, team, 'blank', { solverId });
    startRound(c, team);
    return;
  }
  const piece: PieceState = {
    id: m.nextPieceId++,
    word: round.card.text,
    team,
    drawnBy: round.drawerId,
    solvedBy: solverId,
    stolen,
    tower: null,
    sent: false,
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
}

// ── Build or Send ────────────────────────────────────────────────────────────

export function onDecide(c: Ctx, playerId: PlayerId, pieceId: number, choice: PieceChoice): void {
  const piece = match(c)?.pieces.get(pieceId);
  if (!piece || piece.decideBy === null) return; // already decided (or timed out): ignore quietly
  if (piece.solvedBy !== playerId) {
    sendError(c, playerId, 'FORBIDDEN', 'Only the player who guessed it decides');
    return;
  }
  decide(c, piece, choice);
}

export function onDecideTimer(c: Ctx, pieceId: number): void {
  const piece = match(c)?.pieces.get(pieceId);
  if (piece && piece.decideBy !== null) decide(c, piece, 'build');
}

/** The solver's crew: the drawing's crew, or the other one for a steal. */
const solverTeamOf = (piece: PieceState): Team =>
  piece.stolen ? otherTeam(piece.team) : piece.team;

/** A piece the solver's choosing for, if the solver just left: it's built. */
export function onSolverLeft(c: Ctx, playerId: PlayerId): void {
  const m = match(c);
  if (!m) return;
  for (const piece of m.pieces.values()) {
    if (piece.decideBy !== null && piece.solvedBy === playerId) decide(c, piece, 'build');
  }
}

function decide(c: Ctx, piece: PieceState, choice: PieceChoice): void {
  const m = match(c);
  if (!m) return;
  cancel(c, `decide:${piece.id}`);
  piece.decideBy = null;
  const solverTeam = solverTeamOf(piece);
  const tower = choice === 'build' ? solverTeam : otherTeam(solverTeam);
  piece.tower = tower;
  piece.sent = choice === 'send';
  const solver = c.state.players.get(piece.solvedBy);
  if (piece.sent && solver) solver.stats.sends += 1;
  // A built piece is placed by its solver if they're free; a sent one by the receiving crew.
  m.crews[tower].queue.push({ pieceId: piece.id, placer: piece.sent ? null : piece.solvedBy });
  sendToAll(c, { t: 'piece:queued', pieceId: piece.id, tower, sent: piece.sent });
  tryStartPlacement(c, tower);
}

// ── Placing ──────────────────────────────────────────────────────────────────

/**
 * Who places the next piece: the preferred player if they're free, otherwise the free guesser
 * with the fewest placements this match (join order breaks ties). The drawer never places.
 */
function choosePlacer(c: Ctx, crew: Crew, preferred: PlayerId | null): PlayerId | null {
  const free = members(c, crew.team).filter((p) => p.connected && p.id !== crew.round?.drawerId);
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
  crew.placing = { pieceId: piece.id, placerId, endsAt: c.now + TIMINGS.placeMs };
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
    },
  });
  sendToAll(c, { t: 'place:start', tower: team, placing: crew.placing });
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
  tryStartPlacement(c, team);
}

export function onDazeTimer(c: Ctx, team: Team): void {
  tryStartPlacement(c, team);
}

export function onHeight(c: Ctx, team: Team, height: number): void {
  const crew = match(c)?.crews[team];
  if (!crew) return;
  crew.height = height;
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
