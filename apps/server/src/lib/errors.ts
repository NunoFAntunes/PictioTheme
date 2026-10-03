import type { ErrorCode } from '@pictiotheme/protocol';

/**
 * Expected failures (rule B17). Thrown by services; turned into `{ error: { code, message } }`
 * by plugins/error-handler.ts for HTTP, and into an `error` message for WebSockets.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  constructor(code: ErrorCode, statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const notFound = (what: string) => new AppError('NOT_FOUND', 404, `${what} not found`);
export const forbidden = (message = 'Not allowed') => new AppError('FORBIDDEN', 403, message);
export const unauthenticated = () => new AppError('UNAUTHENTICATED', 401, 'Sign in required');
export const conflict = (message: string) => new AppError('CONFLICT', 409, message);
export const serviceUnavailable = (message: string) =>
  new AppError('SERVICE_UNAVAILABLE', 503, message);
