import type { Piece } from '@pictiotheme/doodle-shape';
import type { PieceBitmap } from '../piece';

/** How a piece looks: its shape and its doodle, cut out. */
export type PieceLook = { piece: Piece; bitmap: PieceBitmap };

/** Paints a piece's doodle with the context at its centroid, turned to its angle. */
export function paintPiece(ctx: CanvasRenderingContext2D, look: PieceLook, ppu: number): void {
  const { piece, bitmap } = look;
  // Logical px are y-down like the screen: no flip, just the piece's scale.
  ctx.scale(piece.scale * ppu, piece.scale * ppu);
  ctx.drawImage(
    bitmap.canvas,
    bitmap.x - piece.origin.x,
    bitmap.y - piece.origin.y,
    bitmap.width,
    bitmap.height,
  );
}
