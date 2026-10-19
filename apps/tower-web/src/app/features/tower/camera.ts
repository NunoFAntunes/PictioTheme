/**
 * Where the tower view looks. World units are y up with the platform's top at y = 0; the view
 * maps them to CSS px. The whole platform plus the placer's reach always fits across, and the
 * view rises with the tower so there's always room above it for the next piece.
 */

export type Camera = {
  /** CSS px per world unit. */
  ppu: number;
  /** The world x at the view's horizontal centre. */
  centerX: number;
  /** The world y at the view's bottom edge. */
  bottom: number;
};

export type CameraInput = {
  width: number;
  height: number;
  platformWidth: number;
  reach: number;
  /** The highest point of anything on the tower (not the piece being placed). */
  towerTop: number;
  /** The topping-out line. */
  line: number;
  /**
   * CSS px at the top and bottom covered by the HUD and the controls: the camera frames the
   * world between them, so the platform never sits under the buttons.
   */
  insetTop?: number;
  insetBottom?: number;
};

/** World units of air kept above the tower for the next piece (it spawns 3.5 above the top). */
export const HEADROOM = 6;
/** Air on each side of the placer's reach, so the view isn't zoomed in too far. */
export const SIDE_MARGIN = 2;
/** How much is shown under the platform's top at the start: the base sits low in the view. */
export const BELOW = 1.2;
/** At least this much height is shown, however wide and short the view. */
export const MIN_VIEW_HEIGHT = 9;
/** The line comes into view once the tower is this close to it. */
const LINE_NEAR = 3;

export function targetCamera({
  width,
  height,
  platformWidth,
  reach,
  towerTop,
  line,
  insetTop = 0,
  insetBottom = 0,
}: CameraInput): Camera {
  const clear = Math.max(1, height - insetTop - insetBottom);
  const viewWidth = platformWidth + 2 * (reach + SIDE_MARGIN);
  const ppu = Math.max(1, Math.min(width / viewWidth, clear / MIN_VIEW_HEIGHT));
  const viewHeight = clear / ppu;
  // Show the line too when the tower is getting close to it.
  const wantedTop = Math.max(towerTop + HEADROOM, line - towerTop < LINE_NEAR ? line + 1.5 : 0);
  // The world y at the bottom of the clear area, then down to the canvas's own bottom edge.
  const clearBottom = Math.max(-BELOW, wantedTop - viewHeight);
  return { ppu, centerX: 0, bottom: clearBottom - insetBottom / ppu };
}

/** Eases `current` towards `target` (exponential, frame-rate independent). */
export function easeCamera(current: Camera | null, target: Camera, dtSeconds: number): Camera {
  if (!current) return target;
  const k = 1 - Math.exp(-dtSeconds * 4);
  return {
    ppu: target.ppu,
    centerX: target.centerX,
    bottom: current.bottom + (target.bottom - current.bottom) * k,
  };
}

/** World → CSS px. */
export function toScreen(
  camera: Camera,
  size: { width: number; height: number },
  x: number,
  y: number,
) {
  return {
    x: size.width / 2 + (x - camera.centerX) * camera.ppu,
    y: size.height - (y - camera.bottom) * camera.ppu,
  };
}
