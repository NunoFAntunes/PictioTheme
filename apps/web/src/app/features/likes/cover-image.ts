import { ROOM_COVER_HEIGHT_PX, ROOM_COVER_WIDTH_PX, RoomCoverImage } from '@pictiotheme/protocol';
import { strokeModel } from '../../realtime';
import { cutoutFitted } from '../avatar';
import { createRenderer } from '../canvas';

/**
 * The current drawing as a room cover: painted off screen from the stroke model, cut out of its
 * background like an avatar, and fitted into ROOM_COVER_WIDTH_PX × ROOM_COVER_HEIGHT_PX. Must run
 * before the next turn clears the model; null if nothing is drawn or it's too big to send.
 */
export function drawingToRoomCover(): RoomCoverImage | null {
  const canvas = document.createElement('canvas');
  // The renderer paints everything once, synchronously, when it's created.
  createRenderer(canvas, strokeModel)();
  const fitted = cutoutFitted(canvas, canvas.width, canvas.height, {
    width: ROOM_COVER_WIDTH_PX,
    height: ROOM_COVER_HEIGHT_PX,
  });
  if (!fitted) return null;
  const parsed = RoomCoverImage.safeParse(fitted.toDataURL('image/png'));
  return parsed.success ? parsed.data : null;
}
