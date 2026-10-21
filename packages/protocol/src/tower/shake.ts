import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../drawing';

/**
 * The Shaky hand spell (docs/tower/planning/power-ups.md): the points of a stroke drawn under it
 * wobble. A pure function of the stroke's id and each point's index in it, so the server (which
 * keeps and forwards the wobbly points) and the drawer's own client (which draws them at once)
 * get the same stroke.
 */

/** How far a point may move, in logical px (the canvas is 1200 × 900). */
export const SHAKE_AMPLITUDE = 18;

function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 1_000;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `[x, y, pressure, …]` triplets, the first one being point number `first` of the stroke. */
export function shakePoints(pts: readonly number[], strokeId: string, first: number): number[] {
  const s = seedOf(strokeId);
  const out: number[] = [];
  for (let k = 0; k + 2 < pts.length; k += 3) {
    const i = first + k / 3;
    const dx = Math.sin(i * 0.37 + s) * 0.7 + Math.sin(i * 1.13 + 2 * s) * 0.3;
    const dy = Math.sin(i * 0.29 + 3 * s) * 0.7 + Math.sin(i * 0.97 + s) * 0.3;
    // Snapped into the canvas first, as the server keeps raw points, so both sides agree.
    const x = clamp(Math.round(pts[k] as number), 0, CANVAS_WIDTH);
    const y = clamp(Math.round(pts[k + 1] as number), 0, CANVAS_HEIGHT);
    out.push(
      clamp(Math.round(x + dx * SHAKE_AMPLITUDE), 0, CANVAS_WIDTH),
      clamp(Math.round(y + dy * SHAKE_AMPLITUDE), 0, CANVAS_HEIGHT),
      pts[k + 2] as number,
    );
  }
  return out;
}
