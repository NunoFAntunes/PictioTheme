import type { ReadyResponse } from '@pictiotheme/protocol';
import type { Db } from '../../db/client';
import { serviceUnavailable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import * as systemRepository from './system.repository';

/**
 * Health and readiness. Also the reference example of the module pattern:
 * routes → service (factory with explicit deps) → repository. See docs/technical/backend-guidelines.md.
 */
export function createSystemService(deps: { db: Db; log: Logger }) {
  return {
    async checkReadiness(): Promise<ReadyResponse> {
      try {
        await systemRepository.pingDatabase(deps.db);
      } catch (err) {
        deps.log.warn({ err }, 'readiness check: database unreachable');
        throw serviceUnavailable('Database unavailable');
      }
      return { status: 'ready', checks: { database: 'ok' } };
    },
  };
}

export type SystemService = ReturnType<typeof createSystemService>;
