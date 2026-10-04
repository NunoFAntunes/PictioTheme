import { CloseCode } from '@pictiotheme/protocol';
import { WebSocket } from 'ws';
import type { RoomTransport } from '../rooms';

/** Above this many queued bytes a client is too slow: drop it, it reconnects with a snapshot (R7). */
const MAX_BUFFERED_BYTES = 1024 * 1024;

/**
 * Which socket belongs to which player in which room. One socket per player: a second tab
 * replaces the first. Implements `RoomTransport` for the rooms module.
 */
export function createConnectionRegistry() {
  const byRoom = new Map<string, Map<string, WebSocket>>();

  const registry = {
    attach(roomCode: string, playerId: string, socket: WebSocket): void {
      const players = byRoom.get(roomCode) ?? new Map<string, WebSocket>();
      const previous = players.get(playerId);
      players.set(playerId, socket);
      byRoom.set(roomCode, players);
      if (previous && previous !== socket) {
        previous.close(CloseCode.replaced, 'Connected from another tab');
      }
    },

    /** True if this socket was the player's current one (so the room should hear about it). */
    detach(roomCode: string, playerId: string, socket: WebSocket): boolean {
      const players = byRoom.get(roomCode);
      if (players?.get(playerId) !== socket) return false;
      players.delete(playerId);
      if (players.size === 0) byRoom.delete(roomCode);
      return true;
    },

    send(roomCode, playerIds, payload) {
      const players = byRoom.get(roomCode);
      if (!players) return;
      for (const id of playerIds) {
        const socket = players.get(id);
        if (socket?.readyState !== WebSocket.OPEN) continue;
        if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
          socket.terminate();
          continue;
        }
        socket.send(payload);
      }
    },

    disconnect(roomCode, playerId, closeCode, reason) {
      byRoom.get(roomCode)?.get(playerId)?.close(closeCode, reason);
    },

    closeRoom(roomCode, closeCode, reason) {
      const players = byRoom.get(roomCode);
      byRoom.delete(roomCode);
      for (const socket of players?.values() ?? []) socket.close(closeCode, reason);
    },
  } satisfies RoomTransport & Record<string, unknown>;

  return registry;
}

export type ConnectionRegistry = ReturnType<typeof createConnectionRegistry>;
