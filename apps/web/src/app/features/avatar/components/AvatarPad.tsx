import type { ReactNode, RefObject } from 'react';
import { DrawingPad } from '../../canvas';

/**
 * The square pad for drawing your avatar, with the game's full drawing toolbar beside it. The
 * strokes stay local: the identity form exports the canvas (avatar-image.ts). `children` (the
 * form's note and Save) sit under the tools.
 */
export function AvatarPad({
  canvasRef,
  children,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  children?: ReactNode;
}) {
  return (
    <DrawingPad
      size={{ width: 512, height: 512 }}
      // Never taller than the screen leaves room for (the dialog's title and the name field).
      frameClassName="aspect-square w-full max-w-[min(26rem,calc(100dvh_-_13rem))]"
      label="Avatar drawing pad"
      toolsLabel="Avatar tools"
      canvasRef={canvasRef}
    >
      {children}
    </DrawingPad>
  );
}
