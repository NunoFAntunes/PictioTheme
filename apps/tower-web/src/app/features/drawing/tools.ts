/**
 * Doodle Tower's drawing tools (docs/tower/design/screens.md#4-game-drawer): a brush in three
 * sizes, an eraser, a short palette. No bucket: enclosed areas fill themselves when the piece is
 * made.
 */

export type DrawTool = 'brush' | 'eraser';

export type DrawSettings = { tool: DrawTool; color: string; size: number };

/** Felt-tip colours that read well on tracing paper and on a piece. */
export const INK_COLORS = [
  { name: 'Ink', hex: '#1b2433' },
  { name: 'Red', hex: '#d93a2b' },
  { name: 'Orange', hex: '#f08a24' },
  { name: 'Green', hex: '#2f9e44' },
  { name: 'Blue', hex: '#1f6feb' },
  { name: 'Purple', hex: '#8e44ad' },
  { name: 'Brown', hex: '#8a5a2b' },
] as const;

export const BRUSH_SIZES = [
  { name: 'Fine', size: 6 },
  { name: 'Medium', size: 14 },
  { name: 'Bold', size: 28 },
] as const;

export const ERASER_SIZE = 40;

export const DEFAULT_DRAW_SETTINGS: DrawSettings = {
  tool: 'brush',
  color: INK_COLORS[0].hex,
  size: BRUSH_SIZES[1].size,
};
