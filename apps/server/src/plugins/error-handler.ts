import type { ErrorBody, ErrorCode } from '@pictiotheme/protocol';
import type { FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors';

/**
 * The one place that turns errors into HTTP responses (rule F4).
 * Every error leaves the server as `{ error: { code, message } }`.
 */

function body(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

export const errorHandler = fp(
  async (app) => {
    app.setErrorHandler<FastifyError | AppError>((err, request, reply) => {
      if (err instanceof AppError) {
        if (err.statusCode >= 500) request.log.error({ err }, err.message);
        return reply.code(err.statusCode).send(body(err.code, err.message));
      }

      if (hasZodFastifySchemaValidationErrors(err)) {
        return reply.code(400).send(body('VALIDATION', err.message));
      }

      // Fastify's own client errors: malformed JSON, body too large, unsupported media type…
      const status = err.statusCode;
      if (status !== undefined && status >= 400 && status < 500) {
        return reply.code(status).send(body(CODE_BY_STATUS[status] ?? 'VALIDATION', err.message));
      }

      request.log.error({ err }, 'unhandled error');
      return reply.code(500).send(body('INTERNAL', 'Something went wrong'));
    });

    app.setNotFoundHandler((request, reply) =>
      reply.code(404).send(body('NOT_FOUND', `Route ${request.method} ${request.url} not found`)),
    );
  },
  { name: 'error-handler' },
);
