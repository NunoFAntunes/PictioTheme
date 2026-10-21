/**
 * The drawing engine both games share: the stroke model, painting strokes at the fixed logical
 * resolution, flood fill, cutting a doodle out of its background, and which pointer may draw.
 * Plain TypeScript, no React, no game rules. Each app keeps its own input handling and toolbar
 * (docs/tower/technical/architecture.md).
 */
export { cutout, type Box, type Pixels } from './cutout';
export { enclosedRegion, floodFill, hexToRgba, isEnclosed, type Region } from './flood-fill';
export { paintOp, type PaintOptions } from './paint';
export { createPointerGate, pointPressure, type PointerGate } from './pointer-gate';
export { createRenderer } from './renderer';
export { createStrokeModel, type DrawOp, type StrokeModel } from './stroke-model';
