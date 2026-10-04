/**
 * How rooms reach players. Implemented by the realtime module (WebSocket connections) and
 * passed in by the composition root, so `rooms` never depends on `realtime`.
 */
export type RoomTransport = {
  /** Deliver one serialized message to these players (those not connected are skipped). */
  send(roomCode: string, playerIds: readonly string[], payload: string): void;
  disconnect(roomCode: string, playerId: string, closeCode: number, reason: string): void;
  closeRoom(roomCode: string, closeCode: number, reason: string): void;
};
