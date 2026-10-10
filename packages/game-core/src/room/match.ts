import type { Award, Card, PlayerId } from '@pictiotheme/protocol';
import { settleOptions, takeOptions, type CardPool } from '../card-pool';
import { prepareCard } from '../guess/classify';
import { randomInt } from '../rng';
import { drawerMultiplier, drawerPoints, rushWindowMs } from '../scoring';
import { buildMask, hintFraction, maxHints, pickHintIndex } from '../word-mask';
import { considerCover, considerFavourite, startLikes } from './likes';
import { broadcastPlayers, cancel, connectedIds, schedule, send, sendToAll } from './output';
import {
  TIMINGS,
  type Ctx,
  type DrawingPhase,
  type MatchEndReason,
  type Phase,
  type PlayerState,
  type RoomState,
  type TurnEndReason,
} from './types';
import { knowsWord, publicRush, toOption } from './views';

/** Match flow: turns, phases, hints, scoring at turn end, pause, results. */

export type { TurnEndReason } from './types';

export function isInMatch(phase: Phase): boolean {
  return phase.kind === 'choosing' || phase.kind === 'drawing' || phase.kind === 'reveal';
}

export function currentDrawerId(c: Ctx): PlayerId | null {
  const { phase } = c.state;
  return phase.kind === 'choosing' || phase.kind === 'drawing' ? phase.drawerId : null;
}

function drawTimeMs(c: Ctx): number {
  return c.state.settings.drawSeconds * 1000;
}

/** Join order, rotated each round so the first drawer changes. */
function turnOrderFor(c: Ctx, round: number): PlayerId[] {
  const ids = [...c.state.players.keys()];
  if (ids.length === 0) return [];
  const shift = (round - 1) % ids.length;
  return [...ids.slice(shift), ...ids.slice(0, shift)];
}

export function startMatch(c: Ctx, pool: CardPool): void {
  const { state } = c;
  for (const p of state.players.values()) {
    p.score = 0;
    p.correctGuesses = 0;
    p.guessTimeMs = 0;
    p.drawerPoints = 0;
  }
  // A drawing left over from a match ended mid-turn still counts for the cover, not the awards.
  considerCover(c);
  state.favourite = null;
  state.pool = pool;
  state.round = 1;
  state.turnOrder = turnOrderFor(c, 1);
  state.turnIndex = -1;
  state.paused = null;
  state.matchStartedAt = c.now;
  state.turnsPlayed = 0;
  c.fx.push({
    kind: 'matchStarted',
    deckId: state.deck?.id ?? null,
    playerIds: [...state.players.keys()],
  });
  cancel(c, 'idle');
  broadcastPlayers(c);
  advance(c);
}

/** Moves to the next connected drawer, the next round, or the results. */
export function advance(c: Ctx): void {
  const { state } = c;
  considerCover(c);
  for (;;) {
    state.turnIndex += 1;
    if (state.turnIndex >= state.turnOrder.length) {
      state.round += 1;
      state.turnOrder = turnOrderFor(c, state.round);
      state.turnIndex = 0;
      if (state.round > state.settings.rounds || state.turnOrder.length === 0) {
        finishMatch(c);
        return;
      }
    }
    const drawerId = state.turnOrder[state.turnIndex];
    const drawer = drawerId === undefined ? undefined : state.players.get(drawerId);
    if (drawer?.connected) {
      startTurn(c, drawer.id);
      return;
    }
  }
}

function startTurn(c: Ctx, drawerId: PlayerId): void {
  const { state } = c;
  state.strokes = [];
  state.redo = [];
  state.pointsThisTurn = 0;
  state.likes = null;

  const taken = takeOptions(state.pool, state.settings.wordChoice, c.rng);
  state.pool = taken.pool;
  const [first] = taken.options;
  if (!first) {
    finishMatch(c);
    return;
  }
  if (taken.reshuffled) sendToAll(c, { t: 'room:notice', code: 'pool_reshuffled' });

  if (state.settings.wordChoice === 1) {
    beginDrawing(c, drawerId, first, taken.options, false);
    return;
  }
  state.phase = {
    kind: 'choosing',
    drawerId,
    options: taken.options,
    endsAt: c.now + TIMINGS.chooseMs,
  };
  schedule(c, 'phase', state.phase.endsAt);
  announcePhase(c);
}

/** `byDrawer`: the drawer tapped it, rather than time running out (a card-quality signal). */
export function chooseCard(c: Ctx, index: number, byDrawer = true): void {
  const { phase } = c.state;
  if (phase.kind !== 'choosing') return;
  const card = phase.options[index];
  if (!card) return;
  beginDrawing(c, phase.drawerId, card, phase.options, byDrawer);
}

function beginDrawing(
  c: Ctx,
  drawerId: PlayerId,
  card: Card,
  options: Card[],
  pickedByDrawer: boolean,
): void {
  const { state } = c;
  c.fx.push({
    kind: 'cardsDealt',
    deckId: state.deck?.id ?? null,
    offered: options.map((o) => o.text),
    drawn: card.text,
    pickedByDrawer,
  });
  state.pool = settleOptions(state.pool, options, card);
  const endsAt = c.now + drawTimeMs(c);
  const hints = state.settings.hints ? maxHints(card.text) : 0;
  const nextHintAt = hints > 0 ? c.now + drawTimeMs(c) * hintFraction(0, hints) : null;
  state.phase = {
    kind: 'drawing',
    drawerId,
    card,
    prepared: prepareCard(card),
    startedAt: c.now,
    endsAt,
    nextHintAt,
    rushMode: state.settings.rush,
    rush: null,
    revealed: new Set(),
    solved: [],
    deltas: {},
  };
  startLikes(c, drawerId);
  schedule(c, 'phase', endsAt);
  if (nextHintAt !== null) schedule(c, 'hint', nextHintAt);
  announcePhase(c);
  broadcastPlayers(c);
}

/** Tells every player about the current phase, with the secret parts only to those allowed. */
export function announcePhase(c: Ctx): void {
  const { state } = c;
  const { phase } = state;
  switch (phase.kind) {
    case 'waiting':
      return;
    case 'choosing': {
      const msg = {
        t: 'phase:choosing',
        drawerId: phase.drawerId,
        round: state.round,
        endsAt: phase.endsAt,
      } as const;
      send(c, connectedIds(c, phase.drawerId), msg);
      send(c, phase.drawerId, { ...msg, options: phase.options.map(toOption) });
      return;
    }
    case 'drawing': {
      const msg = {
        t: 'phase:drawing',
        drawerId: phase.drawerId,
        round: state.round,
        endsAt: phase.endsAt,
        mask: buildMask(phase.card.text, phase.revealed),
        ...(phase.rush && { rush: publicRush(phase.card, phase.rush) }),
      } as const;
      const ids = connectedIds(c);
      send(
        c,
        ids.filter((id) => !knowsWord(state, id)),
        msg,
      );
      send(
        c,
        ids.filter((id) => knowsWord(state, id)),
        { ...msg, word: phase.card.text },
      );
      return;
    }
    case 'reveal':
      sendToAll(c, {
        t: 'phase:reveal',
        word: phase.card.text,
        deltas: phase.deltas,
        endsAt: phase.endsAt,
      });
      return;
    case 'results':
      sendToAll(c, { t: 'phase:results', ranking: phase.ranking, awards: phase.awards });
      return;
  }
}

export function onPhaseTimer(c: Ctx): void {
  const { phase } = c.state;
  if (c.state.paused) return;
  if (phase.kind === 'choosing') chooseCard(c, randomInt(c.rng, phase.options.length), false);
  else if (phase.kind === 'drawing') endTurn(c, 'time');
  else if (phase.kind === 'reveal') advance(c);
}

/** Reveals one more letter to everyone who doesn't know the word. False when none is left. */
function revealHint(c: Ctx, phase: DrawingPhase): boolean {
  const idx = pickHintIndex(phase.card.text, phase.revealed, c.rng);
  if (idx === null) return false;
  phase.revealed.add(idx);
  send(
    c,
    connectedIds(c).filter((id) => !knowsWord(c.state, id)),
    { t: 'hint', mask: buildMask(phase.card.text, phase.revealed) },
  );
  return true;
}

/** Hints are spread from ½ to ⅘ of the draw time (word-mask.ts has how many a card gets). */
export function onHintTimer(c: Ctx): void {
  const { state } = c;
  const { phase } = state;
  if (phase.kind !== 'drawing' || phase.nextHintAt === null || state.paused) return;
  phase.nextHintAt = null;
  if (!revealHint(c, phase)) return;
  const total = maxHints(phase.card.text);
  const k = phase.revealed.size;
  if (k >= total) return;
  const next = c.now + drawTimeMs(c) * (hintFraction(k, total) - hintFraction(k - 1, total));
  if (next >= phase.endsAt) return;
  phase.nextHintAt = next;
  schedule(c, 'hint', next);
}

/** Time drawn so far this turn (pauses don't count). */
export function elapsedMs(c: Ctx, phase: DrawingPhase): number {
  const left = Math.max(0, phase.endsAt - c.now);
  return phase.rush ? phase.rush.elapsedMs + phase.rush.windowMs - left : drawTimeMs(c) - left;
}

/**
 * Rush mode (game-rules.md#rush): the first correct guess cuts the clock to a short window, in
 * which a guess's points drain from what the first guesser got down to the minimum. Players who
 * haven't seen a hint yet get one, so the rush isn't hopeless for them.
 */
export function startRush(c: Ctx, phase: DrawingPhase, fromBase: number): void {
  const left = phase.endsAt - c.now;
  const windowMs = Math.min(left, rushWindowMs(drawTimeMs(c)));
  if (windowMs <= 0) return;
  phase.rush = { windowMs, fromBase, elapsedMs: elapsedMs(c, phase) };
  phase.endsAt = c.now + windowMs;
  schedule(c, 'phase', phase.endsAt);
  if (phase.nextHintAt !== null && phase.revealed.size === 0) revealHint(c, phase);
  if (phase.nextHintAt !== null && phase.nextHintAt >= phase.endsAt) {
    phase.nextHintAt = null;
    cancel(c, 'hint');
  }
  announcePhase(c);
}

/** Ends the turn early once every connected guesser has solved it. */
export function checkAllSolved(c: Ctx): void {
  const { phase } = c.state;
  if (phase.kind !== 'drawing' || phase.solved.length === 0) return;
  const guessers = connectedIds(c, phase.drawerId);
  if (guessers.length > 0 && guessers.every((id) => phase.solved.includes(id))) {
    endTurn(c, 'all_guessed');
  }
}

export function endTurn(c: Ctx, reason: TurnEndReason): void {
  const { state } = c;
  const { phase } = state;
  cancel(c, 'phase');
  cancel(c, 'hint');
  cancel(c, 'drawer-grace');

  if (phase.kind === 'choosing') {
    c.fx.push({
      kind: 'cardsDealt',
      deckId: state.deck?.id ?? null,
      offered: phase.options.map((o) => o.text),
      drawn: null,
      pickedByDrawer: false,
    });
    // No card was drawn: the options go back into the pool.
    state.pool = { ...state.pool, remaining: [...state.pool.remaining, ...phase.options] };
    advance(c);
    return;
  }
  if (phase.kind !== 'drawing') return;

  const deltas = { ...phase.deltas };
  state.turnsPlayed += 1;
  c.fx.push({
    kind: 'turnEnded',
    deckId: state.deck?.id ?? null,
    card: phase.card.text,
    reason,
    guessers: [...state.players.keys()].filter((id) => id !== phase.drawerId).length,
    solved: phase.solved.length,
  });
  // A skipped or abandoned turn gives the drawer nothing; guessers keep what they earned.
  if (reason === 'time' || reason === 'all_guessed') {
    const drawer = state.players.get(phase.drawerId);
    // Guessers still here, plus any who solved and then left. Not players waiting out a disconnect.
    const guessers = new Set([...connectedIds(c, phase.drawerId), ...phase.solved]).size;
    const points = drawerPoints({
      correctGuessers: phase.solved.length,
      totalGuessers: guessers,
      multiplier: drawerMultiplier(phase.card),
    });
    if (drawer && points > 0) {
      drawer.score += points;
      drawer.drawerPoints += points;
      deltas[drawer.id] = points;
    }
  }

  state.phase = { kind: 'reveal', card: phase.card, deltas, endsAt: c.now + TIMINGS.revealMs };
  schedule(c, 'phase', state.phase.endsAt);
  announcePhase(c);
  broadcastPlayers(c);
}

function rankPlayers(players: PlayerState[]): PlayerState[] {
  // Ties: more correct guesses, then faster total guess time (docs/product/game-rules.md#scoring).
  return [...players].sort(
    (a, b) =>
      b.score - a.score || b.correctGuesses - a.correctGuesses || a.guessTimeMs - b.guessTimeMs,
  );
}

function pickAwards(players: PlayerState[], favourite: RoomState['favourite']): Award[] {
  const awards: Award[] = [];
  const [fastest] = players
    .filter((p) => p.correctGuesses > 0)
    .sort((a, b) => a.guessTimeMs / a.correctGuesses - b.guessTimeMs / b.correctGuesses);
  if (fastest) awards.push({ id: 'fastest_guesser', playerId: fastest.id });
  const [bestDrawer] = players
    .filter((p) => p.drawerPoints > 0)
    .sort((a, b) => b.drawerPoints - a.drawerPoints);
  if (bestDrawer) awards.push({ id: 'best_drawer', playerId: bestDrawer.id });
  // The most-liked drawing of the match.
  if (favourite && players.some((p) => p.id === favourite.drawerId)) {
    awards.push({ id: 'crowd_favourite', playerId: favourite.drawerId });
  }
  return awards;
}

export function finishMatch(c: Ctx, reason: MatchEndReason = 'completed'): void {
  const { state } = c;
  for (const timer of ['phase', 'hint', 'drawer-grace', 'alone'] as const) cancel(c, timer);

  considerFavourite(c); // a match ended mid-turn: the drawing on the board counts too
  const ranked = rankPlayers([...state.players.values()]);
  state.phase = {
    kind: 'results',
    ranking: ranked.map((p) => p.id),
    awards: pickAwards(ranked, state.favourite),
  };
  state.paused = null;
  state.strokes = [];
  state.redo = [];
  announcePhase(c);

  if (state.matchStartedAt !== null) {
    c.fx.push({
      kind: 'matchEnded',
      summary: {
        roomCode: state.code,
        deckId: state.deck?.id ?? null,
        reason,
        turns: state.turnsPlayed,
        settings: state.settings,
        startedAt: state.matchStartedAt,
        endedAt: c.now,
        players: ranked.map((p, i) => ({
          id: p.id,
          name: p.name,
          isRegistered: p.isRegistered,
          score: p.score,
          rank: i + 1,
        })),
      },
    });
    state.matchStartedAt = null;
  }
  schedule(c, 'idle', c.now + TIMINGS.idleMs);
}

// ── Pause ──

export function pause(c: Ctx, reason: 'host' | 'players'): void {
  const { state } = c;
  const { phase } = state;
  if (state.paused || !isInMatch(phase)) return;
  state.paused = {
    reason,
    phaseRemainingMs: 'endsAt' in phase ? Math.max(0, phase.endsAt - c.now) : null,
    hintRemainingMs:
      phase.kind === 'drawing' && phase.nextHintAt !== null
        ? Math.max(0, phase.nextHintAt - c.now)
        : null,
  };
  cancel(c, 'phase');
  cancel(c, 'hint');
  sendToAll(c, { t: 'room:paused', paused: reason });
}

export function resume(c: Ctx): void {
  const { state } = c;
  const paused = state.paused;
  if (!paused) return;
  state.paused = null;
  const { phase } = state;
  if ('endsAt' in phase && paused.phaseRemainingMs !== null) {
    phase.endsAt = c.now + paused.phaseRemainingMs;
    schedule(c, 'phase', phase.endsAt);
  }
  if (phase.kind === 'drawing' && paused.hintRemainingMs !== null) {
    phase.nextHintAt = c.now + paused.hintRemainingMs;
    schedule(c, 'hint', phase.nextHintAt);
  }
  sendToAll(c, { t: 'room:paused', paused: null });
  announcePhase(c); // new endsAt for everyone's countdown
}

/**
 * "Everyone but one leaves": the match pauses until someone is back, and the room
 * closes if nobody returns (docs/product/user-flows.md §9).
 */
export function checkPlayerCount(c: Ctx): void {
  const { state } = c;
  const connected = connectedIds(c).length;
  if (isInMatch(state.phase) && connected < 2 && !state.paused) {
    pause(c, 'players');
    schedule(c, 'alone', c.now + TIMINGS.aloneMs);
  } else if (state.paused?.reason === 'players' && connected >= 2) {
    cancel(c, 'alone');
    resume(c);
  }
}
