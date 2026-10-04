import {
  MAX_BRUSH_SIZE,
  MAX_FILL_TOLERANCE,
  MIN_BRUSH_SIZE,
  MIN_OPACITY,
} from '@pictiotheme/protocol';
import type { ToolSettings } from '../tools';

/**
 * Brush-setting maths for the adjust drag and the keyboard steps
 * (drawing-tools.md#adjusting-size-and-opacity). Distances are in screen pixels.
 *
 * Drag right/left changes size (or fill tolerance); drag up/down changes opacity. The gesture
 * locks to one axis once the pointer has moved far enough, so a size change never nudges opacity.
 */

/** Movement before the gesture picks an axis. */
export const AXIS_LOCK_PX = 6;
/** Size doubles every this many pixels: fine control at small sizes, fast at large ones. */
export const SIZE_DOUBLING_PX = 50;
/** Dragging this far sweeps the whole opacity range. */
export const OPACITY_RANGE_PX = 200;
/** Tolerance units per pixel (the full 0–255 range in ~255 px). */
export const TOLERANCE_PER_PX = 1;

export type Axis = 'horizontal' | 'vertical';

export type AdjustPatch = Partial<Pick<ToolSettings, 'size' | 'opacity' | 'fillTolerance'>>;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function clampSize(size: number): number {
  return clamp(Math.round(size), MIN_BRUSH_SIZE, MAX_BRUSH_SIZE);
}

export function clampOpacity(opacity: number): number {
  return clamp(Math.round(opacity * 100) / 100, MIN_OPACITY, 1);
}

export function clampTolerance(tolerance: number): number {
  return clamp(Math.round(tolerance), 0, MAX_FILL_TOLERANCE);
}

/** The axis for a drag of (dx, dy) from the start, or null while it's still undecided. */
export function lockAxis(dx: number, dy: number, current: Axis | null): Axis | null {
  if (current) return current;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return null;
  return Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
}

/** Settings after dragging (dx, dy) from where the gesture began. Up is more opaque. */
export function adjustByDrag(
  start: ToolSettings,
  axis: Axis | null,
  dx: number,
  dy: number,
): AdjustPatch {
  if (axis === 'horizontal') {
    if (start.tool === 'fill') {
      return { fillTolerance: clampTolerance(start.fillTolerance + dx * TOLERANCE_PER_PX) };
    }
    return { size: clampSize(start.size * 2 ** (dx / SIZE_DOUBLING_PX)) };
  }
  if (axis === 'vertical' && start.tool !== 'fill') {
    return { opacity: clampOpacity(start.opacity - (dy / OPACITY_RANGE_PX) * (1 - MIN_OPACITY)) };
  }
  return {};
}

/** One keyboard step: about 19% per press (four presses double it), or ×2 with Shift. */
export function stepSize(size: number, direction: 1 | -1, big: boolean): number {
  const factor = big ? 2 : 2 ** 0.25;
  const next =
    direction > 0
      ? Math.max(size + 1, Math.round(size * factor))
      : Math.min(size - 1, Math.round(size / factor));
  return clampSize(next);
}

export function stepTolerance(tolerance: number, direction: 1 | -1, big: boolean): number {
  return clampTolerance(tolerance + direction * (big ? 32 : 8));
}
