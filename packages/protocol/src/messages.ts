import { z } from 'zod';
import { DeckCoverId, Difficulty } from './deck';
import { DrawBegin, DrawFill, Points, Stroke, StrokeId } from './drawing';
import { ErrorCode } from './errors';
import {
  AvatarId,
  CHAT_MAX_LENGTH,
  DisplayName,
  GUESS_MAX_LENGTH,
  PlayerId,
  RoomCode,
  RoomSettings,
} from './room';

/**
 * WebSocket messages. Envelope: `{ t: '<type>', ...payload }`.
 * The spec lives in docs/technical/realtime-protocol.md; keep them in sync.
 */

/** A drawer's rating of a card option: 👍 or 👎. */
export const CardVote = z.enum(['up', 'down']);
export type CardVote = z.infer<typeof CardVote>;

// ── Client → Server ──────────────────────────────────────────────────────────

const PlayerTarget = { playerId: PlayerId };

export const ClientMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('room:settings'), settings: RoomSettings.partial() }),
  z.object({ t: z.literal('room:start') }),
  z.object({ t: z.literal('room:kick'), ...PlayerTarget }),
  z.object({ t: z.literal('room:transferHost'), ...PlayerTarget }),
  z.object({ t: z.literal('room:pause') }),
  z.object({ t: z.literal('room:resume') }),
  z.object({ t: z.literal('room:skipTurn') }),
  z.object({ t: z.literal('room:end') }),
  z.object({ t: z.literal('vote:kick'), ...PlayerTarget }),
  z.object({ t: z.literal('turn:choose'), index: z.number().int().min(0).max(2) }),
  /**
   * The drawer rates one of the face-up options while choosing (👍 `up`, 👎 `down`, or `null` to
   * take the vote back). It doesn't pick the card. Feeds card quality stats.
   */
  z.object({
    t: z.literal('turn:vote'),
    index: z.number().int().min(0).max(2),
    vote: CardVote.nullable(),
  }),
  z.object({ t: z.literal('draw:begin'), ...DrawBegin.shape }),
  z.object({ t: z.literal('draw:pts'), id: StrokeId, pts: Points }),
  z.object({ t: z.literal('draw:end'), id: StrokeId }),
  z.object({ t: z.literal('draw:fill'), ...DrawFill.shape }),
  z.object({ t: z.literal('draw:undo') }),
  z.object({ t: z.literal('draw:redo') }),
  z.object({ t: z.literal('draw:clear') }),
  z.object({ t: z.literal('guess'), text: z.string().trim().min(1).max(GUESS_MAX_LENGTH) }),
  z.object({ t: z.literal('chat'), text: z.string().trim().min(1).max(CHAT_MAX_LENGTH) }),
  z.object({ t: z.literal('ping'), ts: z.number() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
export type ClientMessageType = ClientMessage['t'];

// ── Shared views ─────────────────────────────────────────────────────────────

export const PublicPlayer = z.object({
  id: PlayerId,
  name: DisplayName,
  avatar: AvatarId,
  score: z.number().int(),
  connected: z.boolean(),
  isHost: z.boolean(),
  guessedThisTurn: z.boolean(),
});
export type PublicPlayer = z.infer<typeof PublicPlayer>;

/** A card as shown to the drawer when choosing. Never sent to guessers. */
export const CardOption = z.object({
  text: z.string(),
  difficulty: Difficulty,
  silly: z.boolean(),
});
export type CardOption = z.infer<typeof CardOption>;

/** `"_____ __ _ ________"`: letters hidden, spaces/hyphens/digits and revealed hints shown. */
export const WordMask = z.string();

export const GuessKind = z.enum(['wrong', 'close', 'correct']);
export type GuessKind = z.infer<typeof GuessKind>;

export const PauseReason = z.enum(['host', 'players']);
export type PauseReason = z.infer<typeof PauseReason>;

/** Informational events shown in the feed ("Ana was kicked", "The deck ran out and was reshuffled"). */
export const NoticeCode = z.enum([
  'pool_reshuffled',
  'player_kicked',
  'vote_kick',
  'host_changed',
  'deck_unavailable',
]);
export type NoticeCode = z.infer<typeof NoticeCode>;

export const Award = z.object({
  id: z.enum(['fastest_guesser', 'best_drawer']),
  playerId: PlayerId,
});
export type Award = z.infer<typeof Award>;

export const PublicPhase = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('waiting') }),
  z.object({ kind: z.literal('choosing'), drawerId: PlayerId, endsAt: z.number() }),
  z.object({ kind: z.literal('drawing'), drawerId: PlayerId, endsAt: z.number(), mask: WordMask }),
  z.object({
    kind: z.literal('reveal'),
    word: z.string(),
    deltas: z.record(PlayerId, z.number().int()),
    endsAt: z.number(),
  }),
  z.object({ kind: z.literal('results'), ranking: z.array(PlayerId), awards: z.array(Award) }),
]);
export type PublicPhase = z.infer<typeof PublicPhase>;

// ── Server → Client ──────────────────────────────────────────────────────────

/** The deck a room plays with. `coverId` is its drawn back cover, or null for the default one. */
export const RoomDeck = z.object({
  id: z.string(),
  title: z.string(),
  coverId: DeckCoverId.nullable(),
});
export type RoomDeck = z.infer<typeof RoomDeck>;

export const ServerMessage = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('room:snapshot'),
    you: PlayerId,
    code: RoomCode,
    name: z.string(),
    isPublic: z.boolean(),
    settings: RoomSettings,
    players: z.array(PublicPlayer),
    phase: PublicPhase,
    paused: PauseReason.nullable(),
    round: z.number().int(),
    deck: RoomDeck.nullable(),
    strokes: z.array(Stroke),
    /** Only for the drawer (options while choosing, word while drawing) or players who solved. */
    secret: z.object({ options: z.array(CardOption).optional(), word: z.string().optional() }),
  }),
  z.object({ t: z.literal('room:players'), players: z.array(PublicPlayer) }),
  z.object({
    t: z.literal('room:settings'),
    settings: RoomSettings,
    deck: RoomDeck.nullable(),
  }),
  z.object({ t: z.literal('room:paused'), paused: PauseReason.nullable() }),
  z.object({
    t: z.literal('room:notice'),
    code: NoticeCode,
    playerId: PlayerId.optional(),
    count: z.number().int().optional(),
    needed: z.number().int().optional(),
  }),
  z.object({
    t: z.literal('phase:choosing'),
    drawerId: PlayerId,
    round: z.number().int(),
    endsAt: z.number(),
    options: z.array(CardOption).optional(),
  }),
  z.object({
    t: z.literal('phase:drawing'),
    drawerId: PlayerId,
    round: z.number().int(),
    endsAt: z.number(),
    mask: WordMask,
    word: z.string().optional(),
  }),
  z.object({ t: z.literal('hint'), mask: WordMask }),
  z.object({ t: z.literal('draw:begin'), ...DrawBegin.shape }),
  z.object({ t: z.literal('draw:pts'), id: StrokeId, pts: Points }),
  z.object({ t: z.literal('draw:end'), id: StrokeId }),
  z.object({ t: z.literal('draw:fill'), ...DrawFill.shape }),
  z.object({ t: z.literal('draw:undo') }),
  z.object({ t: z.literal('draw:redo') }),
  z.object({ t: z.literal('draw:clear') }),
  z.object({
    t: z.literal('guess:feed'),
    playerId: PlayerId,
    kind: GuessKind,
    text: z.string().optional(),
  }),
  z.object({
    t: z.literal('guess:self'),
    kind: GuessKind,
    text: z.string(),
    /** The answer, sent once the guess is correct. */
    word: z.string().optional(),
  }),
  z.object({
    t: z.literal('chat'),
    playerId: PlayerId,
    text: z.string(),
    /** Sent by a player who already solved: only the drawer and other solvers get it (green tint). */
    solvedChannel: z.boolean().optional(),
  }),
  z.object({ t: z.literal('turn:solved'), playerId: PlayerId, order: z.number().int().min(1) }),
  z.object({
    t: z.literal('phase:reveal'),
    word: z.string(),
    deltas: z.record(PlayerId, z.number().int()),
    endsAt: z.number(),
  }),
  z.object({
    t: z.literal('phase:results'),
    ranking: z.array(PlayerId),
    awards: z.array(Award),
  }),
  z.object({ t: z.literal('pong'), ts: z.number(), serverTime: z.number() }),
  z.object({ t: z.literal('error'), code: ErrorCode, message: z.string() }),
  z.object({ t: z.literal('server:restarting') }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
export type ServerMessageType = ServerMessage['t'];
