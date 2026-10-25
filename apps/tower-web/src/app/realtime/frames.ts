import type { Team } from '@pictiotheme/protocol/tower';

/**
 * Tower frames, outside React (rule W9): the latest two poses of every body, with when they
 * arrived. The renderer draws INTERP_MS in the past and interpolates between them, so 20 frames a
 * second look smooth. Bodies missing from a frame were asleep: they keep their last pose.
 */

export const INTERP_MS = 100;

type Pose = { x: number; y: number; angle: number; at: number };
type Track = { prev: Pose; next: Pose };

export type BodyPose = { id: number; x: number; y: number; angle: number };

function createTowerFrames() {
  const tracks = new Map<number, Track>();
  return {
    /** A `tower:frame`: flat `[id, x mm, y mm, angle mrad, …]`. */
    apply(bodies: readonly number[], at: number): void {
      for (let i = 0; i + 3 < bodies.length; i += 4) {
        const id = bodies[i] as number;
        const pose: Pose = {
          x: (bodies[i + 1] as number) / 1000,
          y: (bodies[i + 2] as number) / 1000,
          angle: (bodies[i + 3] as number) / 1000,
          at,
        };
        const track = tracks.get(id);
        // A body seen again after a long while (it slept) starts from where it is.
        if (!track || at - track.next.at > 500) tracks.set(id, { prev: pose, next: pose });
        else tracks.set(id, { prev: track.next, next: pose });
      }
    },
    /** When this body was last in a frame (null: never, or it's been removed). */
    lastSeen(id: number): number | null {
      return tracks.get(id)?.next.at ?? null;
    },
    remove(ids: readonly number[]): void {
      for (const id of ids) tracks.delete(id);
    },
    clear(): void {
      tracks.clear();
    },
    /** Every body's pose at `now` (in the frames' clock), interpolated. */
    poses(now: number): BodyPose[] {
      const t = now - INTERP_MS;
      const out: BodyPose[] = [];
      for (const [id, { prev, next }] of tracks) {
        const span = next.at - prev.at;
        const k = span > 0 ? Math.min(1, Math.max(0, (t - prev.at) / span)) : 1;
        let da = next.angle - prev.angle;
        if (da > Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        out.push({
          id,
          x: prev.x + (next.x - prev.x) * k,
          y: prev.y + (next.y - prev.y) * k,
          angle: prev.angle + da * k,
        });
      }
      return out;
    },
  };
}

export type TowerFrames = ReturnType<typeof createTowerFrames>;

/** Both towers' frames, for the room this tab is in. */
export const towerFrames: Record<Team, TowerFrames> = {
  orange: createTowerFrames(),
  teal: createTowerFrames(),
};
