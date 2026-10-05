/**
 * Scanline flood fill on raw RGBA pixels. Pure, so it is deterministic and unit-testable.
 * Runs at the logical canvas resolution, so every client gets the same result
 * (docs/technical/realtime-protocol.md#drawing-sync).
 */

export type Rgba = [number, number, number, number];

export function hexToRgba(hex: string): Rgba {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/**
 * Fills the region connected to (x, y) whose colour is within `tolerance` (0–255 per channel),
 * then grows it by 1 px (8-neighbourhood) so no unfilled ring is left at a stroke's anti-aliased
 * edge.
 */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fill: Rgba,
  tolerance: number,
): void {
  const x0 = Math.min(width - 1, Math.max(0, Math.round(startX)));
  const y0 = Math.min(height - 1, Math.max(0, Math.round(startY)));
  const start = (y0 * width + x0) * 4;
  const target: Rgba = [
    data[start] ?? 0,
    data[start + 1] ?? 0,
    data[start + 2] ?? 0,
    data[start + 3] ?? 0,
  ];
  if (target.every((v, i) => v === fill[i])) return;

  const matches = (pixel: number) => {
    const i = pixel * 4;
    return (
      Math.abs((data[i] ?? 0) - target[0]) <= tolerance &&
      Math.abs((data[i + 1] ?? 0) - target[1]) <= tolerance &&
      Math.abs((data[i + 2] ?? 0) - target[2]) <= tolerance &&
      Math.abs((data[i + 3] ?? 0) - target[3]) <= tolerance
    );
  };
  const visited = new Uint8Array(width * height);
  let minX = x0;
  let maxX = x0;
  let minY = y0;
  let maxY = y0;
  const setFill = (pixel: number) => {
    const i = pixel * 4;
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  };
  const paint = (pixel: number) => {
    setFill(pixel);
    visited[pixel] = 1;
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  const stack: number[] = [x0, y0];
  while (stack.length > 0) {
    const y = stack.pop() as number;
    let x = stack.pop() as number;
    // Walk left to the start of this run, then fill rightwards, queueing rows above and below.
    while (x > 0 && !visited[y * width + x - 1] && matches(y * width + x - 1)) x -= 1;
    let spanAbove = false;
    let spanBelow = false;
    for (; x < width; x++) {
      const pixel = y * width + x;
      if (visited[pixel] || !matches(pixel)) break;
      paint(pixel);
      if (y > 0) {
        const above = pixel - width;
        const open = !visited[above] && matches(above);
        if (open && !spanAbove) stack.push(x, y - 1);
        spanAbove = open;
      }
      if (y < height - 1) {
        const below = pixel + width;
        const open = !visited[below] && matches(below);
        if (open && !spanBelow) stack.push(x, y + 1);
        spanBelow = open;
      }
    }
  }

  // Grow by 1 px: collect first, so grown pixels don't grow further.
  const edge: number[] = [];
  for (let y = Math.max(0, minY - 1); y <= Math.min(height - 1, maxY + 1); y++) {
    for (let x = Math.max(0, minX - 1); x <= Math.min(width - 1, maxX + 1); x++) {
      if (visited[y * width + x]) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width && visited[ny * width + nx]) {
            touches = true;
            break;
          }
        }
      }
      if (touches) edge.push(y * width + x);
    }
  }
  for (const pixel of edge) setFill(pixel);
}
