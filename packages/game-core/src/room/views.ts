import type {
  CardOption,
  PlayerId,
  PublicPhase,
  PublicPlayer,
  RoomDeck,
  ServerMessage,
} from '@pictiotheme/protocol';
import { buildMask } from '../word-mask';
import type { DeckInfo, Phase, RoomState } from './types';

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
  return { id: deck.id, title: deck.title, coverId: deck.coverId };
}

export function toOption(card: {
  text: string;
  difficulty: CardOption['difficulty'];
  silly: boolean;
}) {
  return { text: card.text, difficulty: card.difficulty, silly: card.silly };
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

export function snapshotFor(state: RoomState, playerId: PlayerId): ServerMessage {
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
    secret,
  };
}
