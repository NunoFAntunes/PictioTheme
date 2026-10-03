import { z } from 'zod';

/** Every error code the server can return, over REST (`{ error: { code } }`) or WebSocket (`error`). */
export const ErrorCode = z.enum([
  'VALIDATION',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
  'SERVICE_UNAVAILABLE',
  // Rooms and game
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_CODE_AMBIGUOUS_LETTERS',
  'NOT_HOST',
  'NOT_DRAWER',
  'WRONG_PHASE',
  'NOT_ENOUGH_PLAYERS',
  // Decks and credits
  'INSUFFICIENT_CREDITS',
  'GENERATION_FAILED',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;
