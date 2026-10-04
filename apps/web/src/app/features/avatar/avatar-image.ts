import { AVATAR_SIZE_PX, AvatarImage } from '@pictiotheme/protocol';

/**
 * Turns the avatar pad into the PNG the server stores (AVATAR_SIZE_PX square, white background),
 * and makes a stand-in from the player's initial when they don't draw anything.
 */

const INITIAL_COLOURS = [
  '#dc2626',
  '#f97316',
  '#16a34a',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
];

function exportCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const ctx = canvas.getContext('2d');
  return ctx ? [canvas, ctx] : null;
}

/** The drawing as a PNG data URL, or null if it can't be encoded within the size limit. */
export function drawingToAvatar(source: HTMLCanvasElement): AvatarImage | null {
  const out = exportCanvas();
  if (!out) return null;
  const [canvas, ctx] = out;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  const parsed = AvatarImage.safeParse(canvas.toDataURL('image/png'));
  return parsed.success ? parsed.data : null;
}

/** A coloured tile with the name's first letter. */
export function initialAvatar(name: string): AvatarImage | null {
  const out = exportCanvas();
  if (!out) return null;
  const [canvas, ctx] = out;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  ctx.fillStyle = INITIAL_COLOURS[hash % INITIAL_COLOURS.length] ?? '#3b82f6';
  ctx.fillRect(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${AVATAR_SIZE_PX * 0.55}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?';
  ctx.fillText(initial, AVATAR_SIZE_PX / 2, AVATAR_SIZE_PX * 0.54);
  const parsed = AvatarImage.safeParse(canvas.toDataURL('image/png'));
  return parsed.success ? parsed.data : null;
}
