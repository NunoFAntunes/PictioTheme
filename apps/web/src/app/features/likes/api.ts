import { RoomCoverUploadResponse, type RoomCoverUpload } from '@pictiotheme/protocol';
import { apiPut } from '../../lib/api';

/** Sends the room the picture it asked for (`cover:request`). */
export function uploadRoomCover(code: string, upload: RoomCoverUpload) {
  return apiPut(`/api/rooms/${encodeURIComponent(code)}/cover`, upload, RoomCoverUploadResponse);
}
