import { AVATAR_SIZE_PX, AvatarImage, CANVAS_HEIGHT, CANVAS_WIDTH } from '@pictiotheme/protocol';
import { cutout } from './cutout';
import { paintOp, type PaintOptions } from './paint';
import type { StrokeModel } from './stroke-model';

/** Room around the cut-out doodle, in canvas pixels, so the outline isn't clipped. */
const CROP_PADDING = 8;

/**
 * The avatar a player drew: their strokes painted on a clear canvas, the doodle cut out of the
 * background (`cutout`) and fitted into the AVATAR_SIZE_PX square, as a PNG data URL. Null if
 * nothing is drawn, or the PNG is too big to be an avatar.
 */
export function drawingToAvatar(model: StrokeModel, paint: PaintOptions = {}): AvatarImage | null {
  const work = document.createElement('canvas');
  work.width = CANVAS_WIDTH;
  work.height = CANVAS_HEIGHT;
  const workCtx = work.getContext('2d', { willReadFrequently: true });
  const out = document.createElement('canvas');
  out.width = AVATAR_SIZE_PX;
  out.height = AVATAR_SIZE_PX;
  const ctx = out.getContext('2d');
  if (!workCtx || !ctx) return null;

  for (const op of model.strokes) paintOp(workCtx, op, paint);
  const pixels = workCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const box = cutout(pixels, CROP_PADDING);
  if (!box) return null;
  workCtx.putImageData(pixels, 0, 0);

  const scale = Math.min(AVATAR_SIZE_PX / box.width, AVATAR_SIZE_PX / box.height);
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
  const parsed = AvatarImage.safeParse(out.toDataURL('image/png'));
  return parsed.success ? parsed.data : null;
}
