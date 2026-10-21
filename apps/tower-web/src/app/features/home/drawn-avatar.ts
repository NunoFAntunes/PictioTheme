import { drawingToAvatar as toAvatar, type StrokeModel } from '@pictiotheme/canvas-engine';
import type { AvatarImage } from '@pictiotheme/protocol';

/**
 * The avatar a player drew, cut out of the paper like a block (canvas-engine's
 * `drawingToAvatar`, with Doodle Tower's enclosed fills). Null if nothing is drawn.
 */
export function drawingToAvatar(model: StrokeModel): AvatarImage | null {
  return toAvatar(model, { enclosedFills: true });
}
