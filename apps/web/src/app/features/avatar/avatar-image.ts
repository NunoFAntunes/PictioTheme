import { AVATAR_SIZE_PX, AvatarImage } from '@pictiotheme/protocol';
import { cutout } from './cutout';

/**
 * Turns the avatar pad into the PNG the server stores: the doodle cut out of its background
 * (transparent) and cropped to fill an AVATAR_SIZE_PX square. The doodle is the player's character.
 * Also makes a stand-in from the player's initial when they don't draw anything.
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

/** Room around the cut-out doodle, in source pixels, so the line boil isn't clipped. */
const CROP_PADDING = 6;

function exportCanvas(size = AVATAR_SIZE_PX): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return ctx ? [canvas, ctx] : null;
}

function encode(canvas: HTMLCanvasElement): AvatarImage | null {
  const parsed = AvatarImage.safeParse(canvas.toDataURL('image/png'));
  return parsed.success ? parsed.data : null;
}

/** Cuts out and crops whatever is drawn on `source`, centred in the avatar square. */
function cutoutToAvatar(source: CanvasImageSource, width: number, height: number) {
  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const workCtx = work.getContext('2d', { willReadFrequently: true });
  const out = exportCanvas();
  if (!workCtx || !out) return null;
  workCtx.drawImage(source, 0, 0, width, height);
  const pixels = workCtx.getImageData(0, 0, width, height);
  const box = cutout(pixels, CROP_PADDING);
  if (!box) return null;
  workCtx.putImageData(pixels, 0, 0);
  const [canvas, ctx] = out;
  const scale = AVATAR_SIZE_PX / Math.max(box.width, box.height);
  const w = box.width * scale;
  const h = box.height * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    work,
    box.x,
    box.y,
    box.width,
    box.height,
    (AVATAR_SIZE_PX - w) / 2,
    (AVATAR_SIZE_PX - h) / 2,
    w,
    h,
  );
  return encode(canvas);
}

/** The drawing as a PNG data URL, or null if it is empty or can't be encoded within the size limit. */
export function drawingToAvatar(source: HTMLCanvasElement): AvatarImage | null {
  return cutoutToAvatar(source, source.width, source.height);
}

/**
 * Re-cuts an avatar saved before avatars were transparent (white square background).
 * Resolves to null if the image can't be decoded or ends up empty.
 */
export async function recutAvatar(avatar: AvatarImage): Promise<AvatarImage | null> {
  const img = new Image();
  img.src = avatar;
  try {
    await img.decode();
  } catch {
    return null;
  }
  return cutoutToAvatar(img, img.naturalWidth, img.naturalHeight);
}

/** The name's first letter, big and coloured with an ink outline, on a transparent background. */
export function initialAvatar(name: string): AvatarImage | null {
  const out = exportCanvas();
  if (!out) return null;
  const [canvas, ctx] = out;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?';
  ctx.font = `900 ${AVATAR_SIZE_PX * 0.8}px ui-rounded, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = AVATAR_SIZE_PX * 0.07;
  ctx.strokeStyle = '#2b2440';
  ctx.fillStyle = INITIAL_COLOURS[hash % INITIAL_COLOURS.length] ?? '#3b82f6';
  const x = AVATAR_SIZE_PX / 2;
  const y = AVATAR_SIZE_PX * 0.55;
  ctx.strokeText(initial, x, y);
  ctx.fillText(initial, x, y);
  return encode(canvas);
}
