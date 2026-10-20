import type { PhysicsOp } from '@pictiotheme/tower-core';
import { Worker } from 'node:worker_threads';
import type { Logger } from '../../../lib/logger';
import type { FromWorker, ToWorker, WorldEvent } from './physics-messages';

/**
 * The pool of physics worker threads. Each tower world lives on one worker for its whole life;
 * new worlds go to the worker with the fewest. Events come back to the world's handler.
 */

export type PhysicsWorld = {
  send(physics: PhysicsOp): void;
  dispose(): void;
};

export type PhysicsPool = {
  createWorld(onEvent: (event: WorldEvent) => void): PhysicsWorld;
  close(): Promise<void>;
};

export function createPhysicsPool(deps: {
  size: number;
  /** The worker's script, and the Node flags to run it with (`--import tsx` outside a build). */
  workerUrl: URL;
  execArgv: string[];
  log: Logger;
}): PhysicsPool {
  type Slot = { worker: Worker; worlds: number };
  const slots: Slot[] = [];
  const handlers = new Map<string, (event: WorldEvent) => void>();
  let nextWorld = 1;

  for (let i = 0; i < Math.max(1, deps.size); i++) {
    const worker = new Worker(deps.workerUrl, { execArgv: deps.execArgv });
    const slot: Slot = { worker, worlds: 0 };
    worker.on('message', (msg: FromWorker) => {
      if (msg.t === 'ready') return;
      if (msg.t === 'failed') {
        deps.log.error({ world: msg.world, message: msg.message }, 'physics step failed');
        return;
      }
      const { world, ...event } = msg;
      handlers.get(world)?.(event);
    });
    worker.on('error', (err: unknown) => deps.log.error({ err }, 'physics worker crashed'));
    // Don't keep the process alive for the workers alone.
    worker.unref();
    slots.push(slot);
  }

  return {
    createWorld(onEvent) {
      const slot = slots.reduce((a, b) => (b.worlds < a.worlds ? b : a));
      const id = `w${nextWorld++}`;
      const post = (msg: ToWorker) => slot.worker.postMessage(msg);
      slot.worlds += 1;
      handlers.set(id, onEvent);
      post({ t: 'create', world: id });
      let disposed = false;
      return {
        send(physics) {
          if (!disposed) post({ t: 'op', world: id, physics });
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          handlers.delete(id);
          slot.worlds -= 1;
          post({ t: 'dispose', world: id });
        },
      };
    },
    async close() {
      await Promise.all(slots.map((s) => s.worker.terminate()));
    },
  };
}
