import type { AvatarId } from '@pictiotheme/protocol';

/**
 * Avatars as stickers: the player's drawing with a paper border round it (it's just ink on a clear
 * background, and dark ink vanishes on the dark panels), and the box its ink fills, so it can
 * stand on its feet whatever shape it is. Built once per avatar, when its image has loaded.
 */

export type Sticker = {
  image: HTMLCanvasElement;
  /** The inked part (border included), as shares of `image`'s width and height. */
  box: { x: number; y: number; width: number; height: number };
};

/** The paper border, in px of the 128 px avatar. */
const BORDER = 5;
const PAD = BORDER + 1;

const loading = new Map<AvatarId, HTMLImageElement>();
const stickers = new Map<AvatarId, Sticker | null>();

function build(img: HTMLImageElement): Sticker | null {
  const w = img.naturalWidth + 2 * PAD;
  const h = img.naturalHeight + 2 * PAD;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // The border: the drawing's shape, in white, stamped all round it.
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.drawImage(img, PAD + Math.cos(a) * BORDER, PAD + Math.sin(a) * BORDER);
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fbf7ee';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(img, PAD, PAD);

  const { data } = ctx.getImageData(0, 0, w, h);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[(y * w + x) * 4 + 3] ?? 0) < 24) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return {
    image: canvas,
    box: { x: x0 / w, y: y0 / h, width: (x1 - x0 + 1) / w, height: (y1 - y0 + 1) / h },
  };
}

/** `avatar`'s sticker, or null while it's loading (or if it can't be drawn). */
export function stickerOf(avatar: AvatarId): Sticker | null {
  const ready = stickers.get(avatar);
  if (ready !== undefined) return ready;
  if (!loading.has(avatar)) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => stickers.set(avatar, build(img));
    img.onerror = () => stickers.set(avatar, null);
    img.src = `/api/avatars/${avatar}`;
    loading.set(avatar, img);
  }
  return null;
}
