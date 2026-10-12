/** True when nothing visible has been drawn on a pad (also after clearing it). */
export function isBlank(source: HTMLCanvasElement): boolean {
  const ctx = source.getContext('2d');
  if (!ctx) return true;
  const { data } = ctx.getImageData(0, 0, source.width, source.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
  return true;
}
