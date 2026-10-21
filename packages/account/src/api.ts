import {
  ErrorBody,
  GuestSessionResponse,
  Profile,
  type UpdateProfileRequest,
} from '@pictiotheme/protocol';
import type { z } from 'zod';

/**
 * The profile's REST calls, same-origin like every game's API (`/api` is proxied to the server).
 * Responses are validated with the protocol schemas.
 */

export class AccountApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AccountApiError';
    this.status = status;
    this.code = code;
  }
}

async function call<S extends z.ZodType>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  schema: S,
  body?: unknown,
): Promise<z.infer<S>> {
  const res = await fetch(path, {
    method,
    headers: {
      accept: 'application/json',
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = ErrorBody.safeParse(json);
    throw error.success
      ? new AccountApiError(res.status, error.data.error.code, error.data.error.message)
      : new AccountApiError(res.status, 'INTERNAL', `Request failed (${res.status})`);
  }
  return schema.parse(json);
}

/** Creates the guest cookie if there isn't one (idempotent). */
export async function ensureGuest(): Promise<void> {
  await call('POST', '/api/session/guest', GuestSessionResponse);
}

export function fetchProfile(): Promise<Profile> {
  return call('GET', '/api/me', Profile);
}

export function putProfile(patch: UpdateProfileRequest): Promise<Profile> {
  return call('PUT', '/api/me', Profile, patch);
}
