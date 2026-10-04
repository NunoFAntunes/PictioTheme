import type { RefObject } from 'react';
import { SketchPad } from '../../canvas';

/** The square pad for drawing your avatar. The identity form exports it (avatar-image.ts). */

const PAD_PX = 512;

export function AvatarPad({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  return (
    <SketchPad
      canvasRef={canvasRef}
      name="Avatar"
      width={PAD_PX}
      height={PAD_PX}
      className="aspect-square w-60"
    />
  );
}
