import { ErrorBody, type ErrorCode } from '@pictiotheme/protocol';
import type { z } from 'zod';

/**
 * Typed REST client. Feature `api.ts` files call these; components never call `fetch` (rule W4).
 * Responses are validated with the shared protocol schemas.
 */

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function parse<S extends z.ZodType>(res: Response, schema: S): Promise<z.infer<S>> {
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = ErrorBody.safeParse(body);
    if (error.success) {
      throw new ApiError(error.data.error.code, res.status, error.data.error.message);
    }
    throw new ApiError('INTERNAL', res.status, `Request failed (${res.status})`);
  }
  return schema.parse(body);
}

export async function apiGet<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  return parse(res, schema);
}

async function send<S extends z.ZodType>(
  method: 'POST' | 'PUT',
  path: string,
  body: unknown,
  schema: S,
): Promise<z.infer<S>> {
  const res = await fetch(path, {
    method,
    headers: {
      accept: 'application/json',
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse(res, schema);
}

export async function apiPost<S extends z.ZodType>(
  path: string,
  body: unknown,
  schema: S,
): Promise<z.infer<S>> {
  return send('POST', path, body, schema);
}

export async function apiPut<S extends z.ZodType>(
  path: string,
  body: unknown,
  schema: S,
): Promise<z.infer<S>> {
  return send('PUT', path, body, schema);
}
