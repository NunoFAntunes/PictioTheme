import { z } from 'zod';
import { Difficulty } from './deck';

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
/** The first 32 hex characters of the image's SHA-256. */
export const AvatarId = z.string().regex(/^[0-9a-f]{32}$/);
export type AvatarId = z.infer<typeof AvatarId>;

export const GuessVisibility = z.enum(['show', 'hide']);
export type GuessVisibility = z.infer<typeof GuessVisibility>;

export const RoomSettings = z.object({
  deckId: z.string().min(1),
  difficulties: z.array(Difficulty).min(1).max(3),
  silly: z.object({
    enabled: z.boolean(),
    ratio: z.number().min(0).max(1),
  }),
  rounds: z.number().int().min(1).max(10),
  drawSeconds: z.number().int().min(30).max(180),
  maxPlayers: z.number().int().min(2).max(16),
  guessVisibility: GuessVisibility,
  hints: z.boolean(),
  wordChoice: z.union([z.literal(1), z.literal(3)]),
});
export type RoomSettings = z.infer<typeof RoomSettings>;

export const DEFAULT_ROOM_SETTINGS: Omit<RoomSettings, 'deckId'> = {
  difficulties: ['easy', 'medium'],
  silly: { enabled: false, ratio: 0.25 },
  rounds: 3,
  drawSeconds: 80,
  maxPlayers: 10,
  guessVisibility: 'show',
  hints: true,
  wordChoice: 3,
};

export const GUESS_MAX_LENGTH = 60;
export const CHAT_MAX_LENGTH = 200;
