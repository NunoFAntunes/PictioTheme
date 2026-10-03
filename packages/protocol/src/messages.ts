import { z } from 'zod';
import { Difficulty } from './deck';
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
  z.object({ kind: z.literal('results'), ranking: z.array(PlayerId) }),
]);
export type PublicPhase = z.infer<typeof PublicPhase>;

// ── Server → Client ──────────────────────────────────────────────────────────

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
    paused: z.boolean(),
    round: z.number().int(),
    strokes: z.array(Stroke),
    /** Only for the drawer (options while choosing, word while drawing) or players who solved. */
    secret: z.object({ options: z.array(CardOption).optional(), word: z.string().optional() }),
  }),
  z.object({ t: z.literal('room:players'), players: z.array(PublicPlayer) }),
  z.object({ t: z.literal('room:settings'), settings: RoomSettings }),
  z.object({ t: z.literal('room:paused'), paused: z.boolean() }),
  z.object({
    t: z.literal('phase:choosing'),
    drawerId: PlayerId,
    endsAt: z.number(),
    options: z.array(CardOption).optional(),
  }),
  z.object({
    t: z.literal('phase:drawing'),
    drawerId: PlayerId,
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
    /** True when sent by a player who already solved (shown with the green "solved" tint). */
    solvedChannel: z.boolean().optional(),
  }),
  z.object({ t: z.literal('guess:self'), kind: GuessKind, text: z.string() }),
  z.object({ t: z.literal('chat'), playerId: PlayerId, text: z.string() }),
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
    awards: z.array(z.object({ id: z.string(), playerId: PlayerId })),
  }),
  z.object({ t: z.literal('pong'), ts: z.number(), serverTime: z.number() }),
  z.object({ t: z.literal('error'), code: ErrorCode, message: z.string() }),
  z.object({ t: z.literal('server:restarting') }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
export type ServerMessageType = ServerMessage['t'];
