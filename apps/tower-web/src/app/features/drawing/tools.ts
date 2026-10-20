/**
 * Doodle Tower's drawing tools (docs/tower/design/screens.md#4-game-drawer): a brush in three
 * sizes, an eraser, a paint bucket, a short palette. The bucket only colours in closed shapes,
 * never the background: enclosed areas are solid in the piece anyway, so it's paint only.
 */

export type DrawTool = 'brush' | 'eraser' | 'fill';

export type DrawSettings = { tool: DrawTool; color: string; size: number };

/** Felt-tip colours that read well on white paper and on a piece. */
export const INK_COLORS = [
  { name: 'Ink', hex: '#1b2433' },
  { name: 'Red', hex: '#d93a2b' },
  { name: 'Orange', hex: '#f08a24' },
  { name: 'Green', hex: '#2f9e44' },
  { name: 'Blue', hex: '#1f6feb' },
  { name: 'Purple', hex: '#8e44ad' },
  { name: 'Brown', hex: '#8a5a2b' },
] as const;

/**
 * The swatch that pops up when a stroke closes a shape: brighter, lighter colours for colouring
 * in, so the ink outlines still read on top of them.
 */
export const FILL_COLORS = [
  { name: 'Yellow', hex: '#ffd43b' },
  { name: 'Orange', hex: '#ff922b' },
  { name: 'Red', hex: '#ff6b6b' },
  { name: 'Pink', hex: '#f783ac' },
  { name: 'Purple', hex: '#b197fc' },
  { name: 'Blue', hex: '#4dabf7' },
  { name: 'Green', hex: '#69db7c' },
] as const;

export const BRUSH_SIZES = [
  { name: 'Fine', size: 6 },
  { name: 'Medium', size: 14 },
  { name: 'Bold', size: 28 },
] as const;

export const ERASER_SIZE = 40;

/** How far (0–255 per channel) a pixel may differ and still be filled: soaks up stroke edges. */
export const FILL_TOLERANCE = 48;

export const DEFAULT_DRAW_SETTINGS: DrawSettings = {
  tool: 'brush',
  color: INK_COLORS[0].hex,
  size: BRUSH_SIZES[1].size,
};
