import {
  GuestSessionResponse,
  JoinRoomResponse,
  RoomLookupResponse,
  type PlayerIdentity,
} from '@pictiotheme/protocol';
import { apiGet, apiPost } from '../../lib/api';

/** The three ways into a game from the home page. Each starts a guest session first. */

/** The server picks the public room with the most players and space, or makes one. */
export async function quickPlay(identity: PlayerIdentity): Promise<JoinRoomResponse> {
  await apiPost('/api/session/guest', undefined, GuestSessionResponse);
  return apiPost('/api/tower/rooms/quick-play', identity, JoinRoomResponse);
}

/** A new private lobby, hosted by this player: friends join with its invite link or code. */
export async function createLobby(identity: PlayerIdentity): Promise<JoinRoomResponse> {
  await apiPost('/api/session/guest', undefined, GuestSessionResponse);
  return apiPost('/api/tower/rooms', { ...identity, isPublic: false }, JoinRoomResponse);
}

/**
 * A private test-mode room, for trying the powers alone (docs/tower/planning/test-mode.md). The
 * server refuses it in production.
 */
export async function createTestRoom(identity: PlayerIdentity): Promise<JoinRoomResponse> {
  await apiPost('/api/session/guest', undefined, GuestSessionResponse);
  return apiPost('/api/tower/rooms', { ...identity, testMode: true }, JoinRoomResponse);
}

/** Whether a code names a live room, so a typo is reported before leaving the page. */
export function lookupRoom(code: string): Promise<RoomLookupResponse> {
  return apiGet(`/api/tower/rooms/${encodeURIComponent(code)}`, RoomLookupResponse);
}
