import { z } from 'zod';

/** Fixed logical canvas. All coordinates are integers in this space. See docs/product/drawing-tools.md. */
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 900;

/** Max points (x,y,p triplets) in one `draw:pts` message. */
export const MAX_POINTS_PER_MESSAGE = 256;

export const StrokeId = z.string().min(1).max(32);
export const Color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const BrushSize = z.number().int().min(1).max(64);
export const Opacity = z.number().min(0.05).max(1);
const X = z.number().int().min(0).max(CANVAS_WIDTH);
const Y = z.number().int().min(0).max(CANVAS_HEIGHT);

/** Flat `[x, y, pressure, x, y, pressure, …]`. Pressure is 0–1 (mouse sends 0.5). */
export const Points = z
  .array(z.number())
  .max(MAX_POINTS_PER_MESSAGE * 3)
  .refine((pts) => pts.length % 3 === 0, 'points must be [x, y, pressure] triplets');

export const StrokeTool = z.enum(['brush', 'eraser']);
export type StrokeTool = z.infer<typeof StrokeTool>;

export const DrawBegin = z.object({
  id: StrokeId,
  tool: StrokeTool,
  color: Color,
  size: BrushSize,
  opacity: Opacity,
  x: X,
  y: Y,
});
export type DrawBegin = z.infer<typeof DrawBegin>;

export const DrawFill = z.object({
  id: StrokeId,
  x: X,
  y: Y,
  color: Color,
  tolerance: z.number().int().min(0).max(255),
});
export type DrawFill = z.infer<typeof DrawFill>;

export const Stroke = z.discriminatedUnion('tool', [
  z.object({
    id: StrokeId,
    tool: StrokeTool,
    color: Color,
    size: BrushSize,
    opacity: Opacity,
    pts: z.array(z.number()),
  }),
  z.object({
    id: StrokeId,
    tool: z.literal('fill'),
    x: X,
    y: Y,
    color: Color,
    tolerance: z.number().int().min(0).max(255),
  }),
]);
export type Stroke = z.infer<typeof Stroke>;
