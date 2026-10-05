import type { ClientMessage, PlayerId, RoomDeck, RoomSettings } from '@pictiotheme/protocol';
import { buildCardPool } from '../card-pool';
import { classifyGuess } from '../guess/classify';
import { hasProfanity, maskProfanity } from '../moderation/profanity';
import { cardMultiplier, guesserPoints } from '../scoring';
import { onDraw } from './drawing';
import {
  checkAllSolved,
  chooseCard,
  endTurn,
  finishMatch,
  isInMatch,
  pause,
  resume,
  startMatch,
} from './match';
import { broadcastPlayers, connectedIds, send, sendError, sendToAll } from './output';
import { onLike } from './likes';
import { kick, transferHost } from './players';
import type { Ctx, Phase } from './types';
import { knowsWord, roomDeck } from './views';

/** Everything a connected player can send. Rules: docs/product/game-rules.md. */

export function onMessage(c: Ctx, playerId: PlayerId, msg: ClientMessage): void {
  const player = c.state.players.get(playerId);
  if (!player?.connected) return;

  switch (msg.t) {
    case 'ping':
      send(c, playerId, { t: 'pong', ts: msg.ts, serverTime: c.now });
      return;
    case 'room:settings':
      updateSettings(c, playerId, msg.settings);
      return;
    case 'room:details':
      updateDetails(c, playerId, msg);
      return;
    case 'room:start':
      requestStart(c, playerId);
      return;
    case 'room:kick':
      if (
        requireHost(c, playerId) &&
        msg.playerId !== playerId &&
        c.state.players.has(msg.playerId)
      ) {
        kick(c, msg.playerId);
      }
      return;
    case 'room:transferHost':
      if (requireHost(c, playerId) && c.state.players.get(msg.playerId)?.connected) {
        transferHost(c, msg.playerId);
      }
      return;
    case 'room:pause':
      if (requireHost(c, playerId)) pause(c, 'host');
      return;
    case 'room:resume':
      if (requireHost(c, playerId) && c.state.paused?.reason === 'host') resume(c);
      return;
    case 'room:skipTurn': {
      const { phase } = c.state;
      if (requireHost(c, playerId) && (phase.kind === 'choosing' || phase.kind === 'drawing')) {
        endTurn(c, 'skipped');
      }
      return;
    }
    case 'room:end':
      if (requireHost(c, playerId) && isInMatch(c.state.phase)) finishMatch(c, 'host_ended');
      return;
    case 'vote:kick':
      voteKick(c, playerId, msg.playerId);
      return;
    case 'turn:choose': {
      const { phase } = c.state;
      if (phase.kind !== 'choosing' || phase.drawerId !== playerId || c.state.paused) {
        sendError(c, playerId, 'WRONG_PHASE', 'Not your turn to choose');
        return;
      }
      chooseCard(c, msg.index);
      return;
    }
    case 'turn:like':
      onLike(c, playerId, msg.liked);
      return;
    case 'turn:vote': {
      const { phase } = c.state;
      const card = phase.kind === 'choosing' ? phase.options[msg.index] : undefined;
      if (phase.kind !== 'choosing' || phase.drawerId !== playerId || !card) {
        sendError(c, playerId, 'WRONG_PHASE', 'You can only rate the cards you are choosing from');
        return;
      }
      c.fx.push({
        kind: 'cardVoted',
        deckId: c.state.deck?.id ?? null,
        card: card.text,
        playerId,
        vote: msg.vote,
      });
      return;
    }
    case 'guess':
      guess(c, playerId, msg.text);
      return;
    case 'chat':
      chat(c, playerId, msg.text);
      return;
    default:
      onDraw(c, playerId, msg);
  }
}

function requireHost(c: Ctx, playerId: PlayerId): boolean {
  if (c.state.hostId === playerId) return true;
  sendError(c, playerId, 'NOT_HOST', 'Only the host can do that');
  return false;
}

// ── Host: settings and start ──

/** Settings that may change during a match (they take effect from the next turn). */
const LIVE_SETTINGS = new Set<keyof RoomSettings>(['guessVisibility', 'hints']);

function updateSettings(c: Ctx, playerId: PlayerId, patch: Partial<RoomSettings>): void {
  const { state } = c;
  if (!requireHost(c, playerId)) return;
  const keys = (Object.keys(patch) as (keyof RoomSettings)[]).filter((k) => patch[k] !== undefined);
  if (isInMatch(state.phase) && keys.some((k) => !LIVE_SETTINGS.has(k))) {
    sendError(c, playerId, 'WRONG_PHASE', 'Only guess visibility and hints can change mid-match');
    return;
  }
  const next: RoomSettings = { ...state.settings };
  for (const k of keys) Object.assign(next, { [k]: patch[k] });
  // Never drop below the players already here.
  next.maxPlayers = Math.max(next.maxPlayers, state.players.size);

  if (next.deckId !== state.settings.deckId) c.fx.push({ kind: 'loadDeck', deckId: next.deckId });
  state.settings = next;
  sendToAll(c, { t: 'room:settings', settings: next, deck: deckRef(c) });
}

/** The room's name and public/private: the host can change them any time. */
function updateDetails(
  c: Ctx,
  playerId: PlayerId,
  patch: { name?: string | undefined; isPublic?: boolean | undefined },
): void {
  const { state } = c;
  if (!requireHost(c, playerId)) return;
  // Public rooms are listed for strangers (security-and-moderation.md), so no offensive names.
  if (patch.name !== undefined && hasProfanity(patch.name)) {
    sendError(c, playerId, 'VALIDATION', "That room name isn't allowed. Please pick another one.");
    return;
  }
  if (patch.name !== undefined) state.name = patch.name;
  if (patch.isPublic !== undefined) state.isPublic = patch.isPublic;
  sendToAll(c, { t: 'room:details', name: state.name, isPublic: state.isPublic });
}

export function deckRef(c: Ctx): RoomDeck | null {
  const { deck, settings } = c.state;
  return deck && deck.id === settings.deckId ? roomDeck(deck) : null;
}

function requestStart(c: Ctx, playerId: PlayerId): void {
  const { state } = c;
  if (!requireHost(c, playerId)) return;
  if (state.phase.kind !== 'waiting' && state.phase.kind !== 'results') {
    sendError(c, playerId, 'WRONG_PHASE', 'A match is already running');
    return;
  }
  if (connectedIds(c).length < 2) {
    sendError(c, playerId, 'NOT_ENOUGH_PLAYERS', 'You need at least 2 players');
    return;
  }
  const deck = state.deck;
  if (!deck || deck.id !== state.settings.deckId) {
    sendError(c, playerId, 'DECK_NOT_READY', 'The deck is still loading');
    return;
  }
  const pool = buildCardPool(deck.cards, state.settings, c.rng);
  if (pool.remaining.length === 0) {
    sendError(c, playerId, 'DECK_NOT_READY', 'No cards match the selected difficulties');
    return;
  }
  startMatch(c, pool);
}

// ── Vote kick ──

function voteKick(c: Ctx, voterId: PlayerId, targetId: PlayerId): void {
  const { state } = c;
  if (voterId === targetId || !state.players.has(targetId)) return;
  const voters = state.kickVotes.get(targetId) ?? new Set<PlayerId>();
  voters.add(voterId);
  state.kickVotes.set(targetId, voters);
  // More than half of the other connected players.
  const needed = Math.floor(connectedIds(c, targetId).length / 2) + 1;
  if (voters.size >= needed) kick(c, targetId);
  else
    sendToAll(c, {
      t: 'room:notice',
      code: 'vote_kick',
      playerId: targetId,
      count: voters.size,
      needed,
    });
}

// ── Guessing and chat ──

type DrawingPhase = Extract<Phase, { kind: 'drawing' }>;

function guess(c: Ctx, playerId: PlayerId, text: string): void {
  const { state } = c;
  const { phase } = state;
  if (phase.kind !== 'drawing' || state.paused) {
    sendError(c, playerId, 'WRONG_PHASE', 'You can only guess while someone is drawing');
    return;
  }
  if (phase.drawerId === playerId) {
    sendError(c, playerId, 'FORBIDDEN', "The drawer can't guess");
    return;
  }
  // Players who already solved type into the same box: it becomes their private channel.
  if (phase.solved.includes(playerId)) {
    solvedChat(c, playerId, text);
    return;
  }

  const kind = classifyGuess(phase.prepared, text);
  if (kind === 'correct') {
    correctGuess(c, phase, playerId, text);
    return;
  }

  send(c, playerId, { t: 'guess:self', kind, text });
  // Who sees what: docs/technical/realtime-protocol.md#guess-feed-who-gets-what
  const others = connectedIds(c, playerId);
  const insiders = others.filter((id) => knowsWord(state, id));
  const outsiders = others.filter((id) => !knowsWord(state, id));
  // Others see guesses with profanity masked; the guesser sees what they typed.
  const shown = maskProfanity(text);
  send(c, insiders, { t: 'guess:feed', playerId, kind, text: shown });
  if (state.settings.guessVisibility === 'show') {
    send(
      c,
      outsiders,
      kind === 'close'
        ? { t: 'guess:feed', playerId, kind: 'close' }
        : { t: 'guess:feed', playerId, kind: 'wrong', text: shown },
    );
  }
}

function correctGuess(c: Ctx, phase: DrawingPhase, playerId: PlayerId, text: string): void {
  const player = c.state.players.get(playerId);
  if (!player) return;
  const drawTimeMs = c.state.settings.drawSeconds * 1000;
  const timeRemainingMs = Math.max(0, phase.endsAt - c.now);
  const points = guesserPoints({
    timeRemainingMs,
    drawTimeMs,
    isFirst: phase.solved.length === 0,
    multiplier: cardMultiplier(phase.card),
  });
  phase.solved.push(playerId);
  phase.deltas[playerId] = points;
  player.score += points;
  player.correctGuesses += 1;
  player.guessTimeMs += drawTimeMs - timeRemainingMs;

  send(c, playerId, { t: 'guess:self', kind: 'correct', text, word: phase.card.text });
  sendToAll(c, { t: 'guess:feed', playerId, kind: 'correct' }, playerId); // never the text
  sendToAll(c, { t: 'turn:solved', playerId, order: phase.solved.length });
  broadcastPlayers(c);
  checkAllSolved(c);
}

/** Messages from solvers reach only the drawer and other solvers, so the answer can't leak. */
function solvedChat(c: Ctx, playerId: PlayerId, text: string): void {
  send(
    c,
    connectedIds(c).filter((id) => knowsWord(c.state, id)),
    { t: 'chat', playerId, text: maskProfanity(text), solvedChannel: true },
  );
}

function chat(c: Ctx, playerId: PlayerId, text: string): void {
  const { phase } = c.state;
  if (phase.kind === 'drawing') {
    if (phase.solved.includes(playerId)) solvedChat(c, playerId, text);
    else if (phase.drawerId === playerId) {
      sendError(c, playerId, 'FORBIDDEN', "You can't chat while drawing");
    } else sendError(c, playerId, 'WRONG_PHASE', 'Type your guess in the guess box');
    return;
  }
  // Masked for everyone, the sender included, so they see what others see.
  sendToAll(c, { t: 'chat', playerId, text: maskProfanity(text) });
}
