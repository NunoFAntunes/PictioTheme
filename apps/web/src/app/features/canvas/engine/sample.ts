/**
 * The eyedropper (drawing-tools.md#picking-and-sampling-colours): the colour you see at a point.
 * The canvas is transparent where nothing was drawn and sits on a white board, so pixels are
 * composited over white. One exact pixel, not an average, so anti-aliased edges don't blend in.
 */

const BACKGROUND = 255;

export function pixelToHex(r: number, g: number, b: number, a: number): string {
  const alpha = a / 255;
  return `#${[r, g, b]
    .map((c) =>
      Math.round(c * alpha + BACKGROUND * (1 - alpha))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** The colour at a logical point of the display canvas. */
export function sampleCanvas(canvas: HTMLCanvasElement, x: number, y: number): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(x)));
  const py = Math.min(canvas.height - 1, Math.max(0, Math.floor(y)));
  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(px, py, 1, 1).data;
  return pixelToHex(r, g, b, a);
}
