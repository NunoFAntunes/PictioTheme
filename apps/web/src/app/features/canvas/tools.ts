/** Drawing tool settings and the preset palette (docs/product/drawing-tools.md). */

export type Tool = 'brush' | 'eraser' | 'fill';

export type ToolSettings = {
  tool: Tool;
  color: string;
  size: number;
  opacity: number;
  fillTolerance: number;
  /** Colours picked, most recent first. `recent[0]` is the last committed colour. */
  recent: string[];
};

export const DEFAULT_TOOL: ToolSettings = {
  tool: 'brush',
  color: '#1f2937',
  size: 8,
  opacity: 1,
  fillTolerance: 32,
  recent: ['#1f2937'],
};

/** Recent colours kept besides the current one (drawing-tools.md: "last 8 used colours"). */
export const RECENT_COLORS = 8;

/**
 * Settings after picking a colour (a swatch, the eyedropper, the popover, `X`).
 * The colour joins the recent list, and the eraser switches to the brush: you picked a colour to paint.
 */
export function withColor(tool: ToolSettings, color: string): ToolSettings {
  const hex = color.toLowerCase();
  return {
    ...tool,
    color: hex,
    tool: tool.tool === 'eraser' ? 'brush' : tool.tool,
    recent: [hex, ...tool.recent.filter((c) => c !== hex)].slice(0, RECENT_COLORS + 1),
  };
}

/** The colour `X` switches to: the most recent one that isn't the current colour. */
export function previousColor(tool: ToolSettings): string | null {
  return tool.recent.find((c) => c !== tool.color) ?? null;
}

export const SIZE_PRESETS = [
  { label: 'S', size: 4 },
  { label: 'M', size: 8 },
  { label: 'L', size: 16 },
  { label: 'XL', size: 32 },
] as const;

/** 24 swatches with good contrast, including skin tones and greys. Labels are for tooltips. */
export const PALETTE: { hex: string; label: string }[] = [
  { hex: '#000000', label: 'Black' },
  { hex: '#4b5563', label: 'Dark grey' },
  { hex: '#9ca3af', label: 'Grey' },
  { hex: '#ffffff', label: 'White' },
  { hex: '#7f1d1d', label: 'Dark red' },
  { hex: '#dc2626', label: 'Red' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#facc15', label: 'Yellow' },
  { hex: '#fef08a', label: 'Light yellow' },
  { hex: '#84cc16', label: 'Lime' },
  { hex: '#16a34a', label: 'Green' },
  { hex: '#14532d', label: 'Dark green' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#1e3a8a', label: 'Navy' },
  { hex: '#8b5cf6', label: 'Violet' },
  { hex: '#d946ef', label: 'Magenta' },
  { hex: '#f9a8d4', label: 'Pink' },
  { hex: '#78350f', label: 'Brown' },
  { hex: '#b45309', label: 'Light brown' },
  { hex: '#ffe0bd', label: 'Skin light' },
  { hex: '#e0ac69', label: 'Skin medium' },
  { hex: '#a0662f', label: 'Skin tan' },
  { hex: '#5c3a21', label: 'Skin dark' },
];
