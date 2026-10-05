import { useEffect } from 'react';
import { onRoomMessage } from '../../../realtime';
import { uploadRoomCover } from '../api';
import { drawingToRoomCover } from '../cover-image';

/**
 * Answers `cover:request`: your drawing is the room's most liked yet, so send a picture of it.
 * The request arrives as the reveal ends, before the next turn clears the canvas, so the picture
 * is taken right away. Renders nothing.
 */
export function CoverUploader() {
  useEffect(
    () =>
      onRoomMessage((msg, _before, after) => {
        if (msg.t !== 'cover:request') return;
        const image = drawingToRoomCover();
        if (!image) return;
        // Best effort: if it fails, the room keeps its old cover.
        uploadRoomCover(after.code, { turn: msg.turn, image }).catch(() => {});
      }),
    [],
  );
  return null;
}
