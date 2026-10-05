import { RoomLookupResponse } from '@pictiotheme/protocol';
import { useMutation } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

/** Checks that a code names a live room before leaving the page for it. */
export function useRoomLookup() {
  return useMutation({
    mutationFn: (code: string) =>
      apiGet(`/api/rooms/${encodeURIComponent(code)}`, RoomLookupResponse),
  });
}
