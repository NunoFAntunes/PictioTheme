import type { ReactNode, RefObject } from 'react';
import { DrawingPad } from '../../canvas';

/**
 * The 3:4 pad for drawing a deck's back cover, with the game's full drawing toolbar beside it.
 * The strokes stay local: its owner exports the canvas with `drawingToCover`. `children` (the
 * owner's Save/Skip) sit under the tools.
 */
export function CoverPad({
  canvasRef,
  children,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  children?: ReactNode;
}) {
  return (
    <DrawingPad
      size={{ width: 600, height: 800 }}
      // Never taller than the screen leaves room for (the dialog's title and padding).
      frameClassName="aspect-[3/4] w-full max-w-[min(24rem,calc((100dvh_-_11rem)*0.75))]"
      label="Deck cover drawing pad"
      toolsLabel="Deck cover tools"
      canvasRef={canvasRef}
    >
      {children}
    </DrawingPad>
  );
}
