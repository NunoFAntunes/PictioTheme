import { z } from 'zod';

/** REST DTOs shared by the server and the web app. */

export const HealthResponse = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ReadyResponse = z.object({
  status: z.literal('ready'),
  checks: z.object({
    database: z.literal('ok'),
  }),
});
export type ReadyResponse = z.infer<typeof ReadyResponse>;
