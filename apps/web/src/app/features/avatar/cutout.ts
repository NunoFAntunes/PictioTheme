/**
 * Cuts a doodle out of its background: near-white pixels connected to the image edge become
 * transparent (white enclosed by lines, like a cat's eyes, stays), then the opaque pixels are boxed.
 * Pure: works on anything shaped like ImageData, in place.
 */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };

/** Every channel at least this bright counts as background white. */
const WHITE = 235;
/** Alpha at or below this counts as already transparent. */
const CLEAR = 8;

function isBackground(data: Uint8ClampedArray, i: number): boolean {
  const a = data[i + 3] ?? 0;
  if (a <= CLEAR) return true;
  return (data[i] ?? 0) >= WHITE && (data[i + 1] ?? 0) >= WHITE && (data[i + 2] ?? 0) >= WHITE;
}

/** Clears the edge-connected background. Returns the opaque pixels' box, or null if nothing is left. */
export function cutout({ data, width, height }: Pixels, padding = 0): Box | null {
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * width + x;
    if (seen[p] || !isBackground(data, p * 4)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const p = stack.pop() ?? 0;
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= CLEAR) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  return {
    x,
    y,
    width: Math.min(width, maxX + 1 + padding) - x,
    height: Math.min(height, maxY + 1 + padding) - y,
  };
}
