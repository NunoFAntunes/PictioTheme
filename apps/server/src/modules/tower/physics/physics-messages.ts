import type { PhysicsOp } from '@pictiotheme/tower-core';

/**
 * Messages between the main thread and a physics worker (physics.worker.ts). A worker owns many
 * worlds (one per tower), each named by an id the pool picks.
 */

export type ToWorker =
  | { t: 'create'; world: string }
  | { t: 'op'; world: string; physics: PhysicsOp }
  | { t: 'dispose'; world: string };

export type WorldEvent =
  /** The moving bodies, 20 times a second; a full frame (`full`) once a second. */
  | { t: 'frame'; tick: number; bodies: number[]; full: boolean }
  | { t: 'released'; pieceId: number }
  | { t: 'fumbled'; pieceIds: number[] }
  /** The pigeon left: scared away by a new piece, or fallen. */
  | { t: 'pigeonGone' }
  /** `starHeld`: a settled piece of the tower is touching its sky star. */
  | { t: 'height'; height: number; starHeld: boolean };

export type FromWorker =
  | { t: 'ready' }
  | ({ world: string } & WorldEvent)
  | { t: 'failed'; world: string | null; message: string };

/** Steps per frame sent (60 Hz physics → 20 Hz frames), per height report, per full frame. */
export const FRAME_EVERY = 3;
export const HEIGHT_EVERY = 6;
export const FULL_FRAME_EVERY = 60;
