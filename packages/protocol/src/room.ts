import { z } from 'zod';
import { Difficulty } from './deck';
import { DEFAULT_DECK_LANGUAGE, DeckLanguage } from './language';

/** `ABC-DEF`: 24 letters (A–Z without I and O). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const RoomCode = z.string().regex(/^[A-HJ-NP-Z]{3}-[A-HJ-NP-Z]{3}$/);
export type RoomCode = z.infer<typeof RoomCode>;

export const PlayerId = z.string().min(1).max(64);
export type PlayerId = z.infer<typeof PlayerId>;

export const DisplayName = z.string().trim().min(2).max(20);
export const RoomName = z.string().trim().min(2).max(40);
/**
 * Avatars are drawn by the players. The client sends the image as a PNG data URL; the server
 * stores it content-addressed and everyone else refers to it by id (`GET /api/avatars/:id`).
 */
export const AVATAR_SIZE_PX = 128;
export const AVATAR_MAX_BYTES = 40_000;
const AVATAR_DATA_URL_PREFIX = 'data:image/png;base64,';
export const AvatarImage = z
  .string()
  .startsWith(AVATAR_DATA_URL_PREFIX)
  .max(AVATAR_DATA_URL_PREFIX.length + Math.ceil(AVATAR_MAX_BYTES / 3) * 4);
export type AvatarImage = z.infer<typeof AvatarImage>;
/**
 * A room's cover: its most-liked drawing, cut out of the white background (transparent PNG),
 * shown on the home page's room notes (game-rules.md, likes).
 */
export const ROOM_COVER_WIDTH_PX = 320;
export const ROOM_COVER_HEIGHT_PX = 240;
export const ROOM_COVER_MAX_BYTES = 120_000;
export const RoomCoverImage = z
  .string()
  .startsWith(AVATAR_DATA_URL_PREFIX)
  .max(AVATAR_DATA_URL_PREFIX.length + Math.ceil(ROOM_COVER_MAX_BYTES / 3) * 4);
export type RoomCoverImage = z.infer<typeof RoomCoverImage>;
/** The first 32 hex characters of the image's SHA-256. */
export const AvatarId = z.string().regex(/^[0-9a-f]{32}$/);
export type AvatarId = z.infer<typeof AvatarId>;

export const GuessVisibility = z.enum(['show', 'hide']);
export type GuessVisibility = z.infer<typeof GuessVisibility>;

/**
 * Normal plays the deck's easy and/or hard cards; Chaos plays only its Chaos cards
 * (game-rules.md#card-pool).
 */
export const GameMode = z.enum(['normal', 'chaos']);
export type GameMode = z.infer<typeof GameMode>;

/** What the host can set the match's length and the room's size to. */
export const ROUNDS_RANGE = { min: 1, max: 10 } as const;
export const DRAW_SECONDS_RANGE = { min: 20, max: 260 } as const;
export const MAX_PLAYERS_RANGE = { min: 2, max: 16 } as const;

export const RoomSettings = z.object({
  deckId: z.string().min(1),
  mode: GameMode,
  /** Normal mode only: which difficulties to deal. */
  difficulties: z.array(Difficulty).min(1).max(2),
  rounds: z.number().int().min(ROUNDS_RANGE.min).max(ROUNDS_RANGE.max),
  drawSeconds: z.number().int().min(DRAW_SECONDS_RANGE.min).max(DRAW_SECONDS_RANGE.max),
  maxPlayers: z.number().int().min(MAX_PLAYERS_RANGE.min).max(MAX_PLAYERS_RANGE.max),
  guessVisibility: GuessVisibility,
  hints: z.boolean(),
  /** Rush: after the first correct guess the clock drops to a short window and points drain. */
  rush: z.boolean(),
  wordChoice: z.union([z.literal(1), z.literal(3)]),
  /** What the cards are written in. A match only starts with a deck in this language. */
  language: DeckLanguage,
});
export type RoomSettings = z.infer<typeof RoomSettings>;

export const DEFAULT_ROOM_SETTINGS: Omit<RoomSettings, 'deckId'> = {
  mode: 'normal',
  difficulties: ['easy', 'hard'],
  rounds: 3,
  drawSeconds: 80,
  maxPlayers: 10,
  guessVisibility: 'show',
  hints: true,
  rush: false,
  wordChoice: 3,
  language: DEFAULT_DECK_LANGUAGE,
};

export const GUESS_MAX_LENGTH = 60;
export const CHAT_MAX_LENGTH = 200;
