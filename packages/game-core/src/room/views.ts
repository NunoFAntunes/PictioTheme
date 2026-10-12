import type {
  Card,
  CardOption,
  PlayerId,
  PublicPhase,
  PublicPlayer,
  RoomDeck,
  RushWindow,
  ServerMessage,
} from '@pictiotheme/protocol';
import { cardMultiplier, rushPoints } from '../scoring';
import { buildMask } from '../word-mask';
import { emoteCharges } from './emote-charges';
import type { DeckInfo, DrawingPhase, Phase, RoomState } from './types';

/**
 * What each player is allowed to see. The secret word never leaves the server
 * except to the drawer and to players who already solved (rule R2).
 */

export function publicPlayers(state: RoomState): PublicPlayer[] {
  const solved = state.phase.kind === 'drawing' ? new Set(state.phase.solved) : new Set();
  return [...state.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    connected: p.connected,
    isHost: p.id === state.hostId,
    guessedThisTurn: solved.has(p.id),
  }));
}

/** What players see of a deck: never its cards. */
export function roomDeck(deck: DeckInfo): RoomDeck {
  return {
    id: deck.id,
    title: deck.title,
    coverId: deck.coverId,
    language: deck.language,
    chaosCards: deck.cards.filter((c) => c.kind === 'chaos').length,
  };
}

export function toOption(card: CardOption): CardOption {
  return { text: card.text, kind: card.kind };
}

export function publicPhase(phase: Phase): PublicPhase {
  switch (phase.kind) {
    case 'waiting':
      return { kind: 'waiting' };
    case 'choosing':
      return { kind: 'choosing', drawerId: phase.drawerId, endsAt: phase.endsAt };
    case 'drawing':
      return {
        kind: 'drawing',
        drawerId: phase.drawerId,
        endsAt: phase.endsAt,
        mask: buildMask(phase.card.text, phase.revealed),
        ...(phase.rush && { rush: publicRush(phase.card, phase.rush) }),
      };
    case 'reveal':
      return { kind: 'reveal', word: phase.card.text, deltas: phase.deltas, endsAt: phase.endsAt };
    case 'results':
      return { kind: 'results', ranking: phase.ranking, awards: phase.awards };
  }
}

/** Can this player see the current word? */
export function knowsWord(state: RoomState, playerId: PlayerId): boolean {
  const { phase } = state;
  return (
    phase.kind === 'drawing' && (phase.drawerId === playerId || phase.solved.includes(playerId))
  );
}

export function snapshotFor(state: RoomState, playerId: PlayerId, now: number): ServerMessage {
  const { phase } = state;
  const secret: { options?: CardOption[]; word?: string } = {};
  if (phase.kind === 'choosing' && phase.drawerId === playerId) {
    secret.options = phase.options.map(toOption);
  }
  if (phase.kind === 'drawing' && knowsWord(state, playerId)) secret.word = phase.card.text;

  return {
    t: 'room:snapshot',
    you: playerId,
    code: state.code,
    name: state.name,
    isPublic: state.isPublic,
    settings: state.settings,
    players: publicPlayers(state),
    phase: publicPhase(phase),
    paused: state.paused?.reason ?? null,
    round: state.round,
    deck: state.deck ? roomDeck(state.deck) : null,
    strokes: state.strokes,
    likers: [...(state.likes?.likers ?? [])],
    emoteCharges: emoteCharges(state, playerId, now),
    secret,
  };
}

/** The rush window as players see it, with the card multiplier applied. */
export function publicRush(card: Card, rush: NonNullable<DrawingPhase['rush']>): RushWindow {
  const multiplier = cardMultiplier(card);
  return {
    windowMs: rush.windowMs,
    fromPoints: Math.round(rush.fromBase * multiplier),
    toPoints: Math.round(rushPoints(rush.fromBase, 0, rush.windowMs) * multiplier),
  };
}
