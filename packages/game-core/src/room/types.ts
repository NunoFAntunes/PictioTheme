import type {
  AvatarId,
  Award,
  Card,
  CardVote,
  ClientMessage,
  PauseReason,
  PlayerId,
  RoomSettings,
  ServerMessage,
  Stroke,
} from '@pictiotheme/protocol';
import type { CardPool } from '../card-pool';
import type { PreparedCard } from '../guess/classify';
import type { Rng } from '../rng';

/**
 * The authoritative room state machine: `step(state, event, ctx) → effects`.
 * Rules: docs/product/game-rules.md and the edge cases in docs/product/user-flows.md §9.
 * Pattern: docs/technical/backend-guidelines.md#realtime-rules (functional core, imperative shell).
 */

export const TIMINGS = {
  chooseMs: 10_000,
  revealMs: 5_000,
  /** A disconnected player is removed after this. */
  playerGraceMs: 120_000,
  /** A disconnected drawer loses their turn after this. */
  drawerGraceMs: 15_000,
  /** Host rights pass to someone else after the host is gone this long. */
  hostGraceMs: 30_000,
  /** A match paused because only one player is left closes after this. */
  aloneMs: 5 * 60_000,
  /** A room sitting in the waiting or results screen closes after this. */
  idleMs: 30 * 60_000,
} as const;

/** Drawing points per turn, to stop bandwidth abuse (docs/technical/realtime-protocol.md). */
export const MAX_POINTS_PER_TURN = 100_000;

export type PlayerState = {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  isRegistered: boolean;
  connected: boolean;
  joinedAt: number;
  score: number;
  // Match stats, for tie-breaks and awards.
  correctGuesses: number;
  guessTimeMs: number;
  drawerPoints: number;
};

export type DeckInfo = { id: string; title: string; coverId: string | null; cards: Card[] };

export type Phase =
  | { kind: 'waiting' }
  | { kind: 'choosing'; drawerId: PlayerId; options: Card[]; endsAt: number }
  | {
      kind: 'drawing';
      drawerId: PlayerId;
      card: Card;
      prepared: PreparedCard;
      startedAt: number;
      endsAt: number;
      nextHintAt: number | null;
      revealed: Set<number>;
      /** Players who guessed correctly, in order. */
      solved: PlayerId[];
      deltas: Record<PlayerId, number>;
    }
  | { kind: 'reveal'; card: Card; deltas: Record<PlayerId, number>; endsAt: number }
  | { kind: 'results'; ranking: PlayerId[]; awards: Award[] };

export type Pause = {
  reason: PauseReason;
  /** Time left on the phase timer when paused (null in phases without one). */
  phaseRemainingMs: number | null;
  hintRemainingMs: number | null;
};

export type RoomState = {
  code: string;
  name: string;
  isPublic: boolean;
  createdAt: number;
  hostId: PlayerId;
  settings: RoomSettings;
  /** Insertion order is join order, which drives the drawing rotation. */
  players: Map<PlayerId, PlayerState>;
  banned: Set<PlayerId>;
  deck: DeckInfo | null;
  phase: Phase;
  paused: Pause | null;
  round: number;
  turnOrder: PlayerId[];
  turnIndex: number;
  pool: CardPool;
  strokes: Stroke[];
  redo: Stroke[];
  pointsThisTurn: number;
  opSeq: number;
  /** target → voters */
  kickVotes: Map<PlayerId, Set<PlayerId>>;
  matchStartedAt: number | null;
  /** Turns drawn in the current match, for the match summary. */
  turnsPlayed: number;
  /** The current drawing's ❤️: who drew it and who liked it. Null outside a drawing and its reveal. */
  likes: { drawerId: PlayerId; likers: Set<PlayerId> } | null;
  /** The room's cover: its most-liked drawing so far. `version` goes up with each new one. */
  cover: { likes: number; version: number } | null;
  /** A drawing that beat the cover, waiting for its drawer to send a picture (cover:request). */
  pendingCover: { turn: number; likes: number; drawerId: PlayerId } | null;
};

export type TimerId =
  'phase' | 'hint' | 'idle' | 'alone' | 'drawer-grace' | 'host-grace' | `grace:${string}`;

export type JoiningPlayer = {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  isRegistered: boolean;
};

export type RoomEvent =
  /** Right after creation: load the deck, start the idle timer. */
  | { type: 'init' }
  /** A socket connected for this player (new player or reconnect). */
  | { type: 'join'; player: JoiningPlayer }
  | { type: 'disconnect'; playerId: PlayerId }
  /**
   * A player in the room changed their name or avatar (`PUT /api/rooms/:code/me`). The shell has
   * already checked the name and stored the avatar.
   */
  | { type: 'identity'; playerId: PlayerId; name: string; avatar: AvatarId }
  | { type: 'message'; playerId: PlayerId; msg: ClientMessage }
  | { type: 'timer'; timer: TimerId }
  | { type: 'deckLoaded'; deck: DeckInfo }
  | { type: 'deckFailed'; deckId: string }
  /** The shell stored the picture for the pending cover (`PUT /api/rooms/:code/cover`). */
  | { type: 'coverStored'; turn: number };

export type DisconnectReason = 'kicked' | 'banned' | 'room_full' | 'room_closed';

/** Why a turn ended. */
export type TurnEndReason = 'time' | 'all_guessed' | 'skipped' | 'drawer_left';

/**
 * Why a match ended: played to the end (or the deck ran out), ended by the host, or abandoned
 * (everyone else left and nobody came back).
 */
export type MatchEndReason = 'completed' | 'host_ended' | 'abandoned';

export type MatchSummary = {
  roomCode: string;
  deckId: string | null;
  reason: MatchEndReason;
  /** Turns where a card was drawn. */
  turns: number;
  settings: RoomSettings;
  startedAt: number;
  endedAt: number;
  players: { id: PlayerId; name: string; isRegistered: boolean; score: number; rank: number }[];
};

export type Effect =
  /** Send one message to these players. The shell serializes it once (rule R6). */
  | { kind: 'send'; to: PlayerId[]; msg: ServerMessage }
  /** (Re)schedule a timer. Scheduling an id that already exists replaces it. */
  | { kind: 'schedule'; timer: TimerId; at: number }
  | { kind: 'cancel'; timer: TimerId }
  | { kind: 'loadDeck'; deckId: string }
  | { kind: 'disconnect'; playerId: PlayerId; reason: DisconnectReason }
  | { kind: 'matchEnded'; summary: MatchSummary }
  // Metrics (docs/technical/data-model.md#metrics): the shell records these, nothing else changes.
  | { kind: 'matchStarted'; deckId: string | null; playerIds: PlayerId[] }
  /**
   * A turn's cards were dealt. `offered`: every option shown (one when there's no choice);
   * `drawn`: the card drawn, or null if the turn ended before one was chosen; `pickedByDrawer`:
   * the drawer chose it (not picked at random when time ran out).
   */
  | {
      kind: 'cardsDealt';
      deckId: string | null;
      offered: string[];
      drawn: string | null;
      pickedByDrawer: boolean;
    }
  | {
      kind: 'turnEnded';
      deckId: string | null;
      card: string;
      reason: TurnEndReason;
      guessers: number;
      solved: number;
    }
  /** The drawer rated a face-up option (null: took the vote back). */
  | {
      kind: 'cardVoted';
      deckId: string | null;
      card: string;
      playerId: PlayerId;
      vote: CardVote | null;
    }
  /** The room is over: the shell disposes it and closes every socket. */
  /** Close the room. `byHost`: the host closed it (`room:close`), not the idle or alone timer. */
  | { kind: 'close'; byHost?: true };

/** The effects the shell records for the launch metrics; they never change the game. */
export type MetricEffect = Extract<
  Effect,
  { kind: 'matchStarted' | 'matchEnded' | 'cardsDealt' | 'turnEnded' | 'cardVoted' }
>;

export type StepContext = { now: number; rng: Rng };

/** Passed to every handler: the state, the time and randomness, and the effects being collected. */
export type Ctx = StepContext & { state: RoomState; fx: Effect[] };
