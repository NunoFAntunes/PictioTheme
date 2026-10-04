import {
  CloseCode,
  GuestSessionResponse,
  JoinRoomResponse,
  ServerMessage,
  type ClientMessage,
  type PlayerIdentity,
} from '@pictiotheme/protocol';
import { ApiError, apiPost } from '../lib/api';
import { serverNow, useRoomStore, type CloseReason } from './room-store';
import { applyServerMessage, startsNewDrawing, viewFromSnapshot, type RoomView } from './room-view';
import { createStrokeModel, type DrawOp } from './stroke-model';

/**
 * The only code that touches the WebSocket (rule W5). One room per tab.
 * Every (re)connect asks for a fresh join token first: tokens live 60 seconds.
 * Close codes: docs/technical/realtime-protocol.md#close-codes.
 */

/** The current drawing, rendered by the canvas feature. */
export const strokeModel = createStrokeModel();

const PING_INTERVAL_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 8;

const FINAL_CLOSES: Record<number, [CloseReason, string]> = {
  [CloseCode.replaced]: ['replaced', 'This room is open in another tab.'],
  [CloseCode.kicked]: ['kicked', 'You were removed from the room.'],
  [CloseCode.banned]: ['banned', 'You were removed from the room.'],
  [CloseCode.roomClosed]: ['room_closed', 'This room has closed.'],
  [CloseCode.roomFull]: ['full', 'This room is full.'],
  [CloseCode.policy]: ['lost', 'The connection was closed.'],
};

let socket: WebSocket | null = null;

/** Called after each room message is applied, with the view before and after (for sounds). */
export type RoomMessageListener = (
  msg: ServerMessage,
  before: RoomView | null,
  after: RoomView,
) => void;
const listeners = new Set<RoomMessageListener>();

/** Subscribes to applied room messages. Returns a function that unsubscribes. */
export function onRoomMessage(listener: RoomMessageListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(msg: ServerMessage, before: RoomView | null, after: RoomView): void {
  for (const listener of listeners) listener(msg, before, after);
}

function setConnection(connection: ReturnType<typeof useRoomStore.getState>['connection']) {
  useRoomStore.setState({ connection });
}

function close(reason: CloseReason, message: string) {
  setConnection({ kind: 'closed', reason, message });
}

function handleMessage(msg: ServerMessage): void {
  if (msg.t === 'pong') {
    // Halfway through the round trip, the server's clock read serverTime.
    const now = Date.now();
    useRoomStore.setState({ clockOffset: msg.serverTime - (msg.ts + now) / 2 });
    return;
  }
  if (msg.t.startsWith('draw:')) {
    strokeModel.apply(msg as DrawOp);
    return;
  }
  const { view } = useRoomStore.getState();
  if (msg.t === 'room:snapshot') {
    strokeModel.reset(msg.strokes);
    const next = viewFromSnapshot(msg, view);
    useRoomStore.setState({ view: next });
    notify(msg, view, next);
    return;
  }
  if (!view) return; // nothing before the snapshot
  if (startsNewDrawing(view, msg)) strokeModel.reset([]);
  const next = applyServerMessage(view, msg, serverNow());
  useRoomStore.setState({ view: next });
  notify(msg, view, next);
}

/** Connects to a room and keeps the connection alive. Returns a function that leaves. */
export function connectRoom(code: string, identity: PlayerIdentity): () => void {
  let stopped = false;
  let attempt = 0;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  useRoomStore.setState({ view: null, connection: { kind: 'connecting' } });
  strokeModel.reset([]);

  const scheduleRetry = () => {
    attempt += 1;
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      close('lost', 'Lost connection to the server.');
      return;
    }
    setConnection({ kind: 'reconnecting', attempt });
    const delay = Math.min(10_000, 500 * 2 ** attempt) + Math.random() * 300;
    retryTimer = setTimeout(() => void open(), delay);
  };

  const open = async () => {
    if (stopped) return;
    let token: string;
    try {
      await apiPost('/api/session/guest', undefined, GuestSessionResponse);
      token = (
        await apiPost(`/api/rooms/${encodeURIComponent(code)}/join`, identity, JoinRoomResponse)
      ).joinToken;
    } catch (err) {
      if (stopped) return;
      if (err instanceof ApiError && err.status < 500 && err.code !== 'RATE_LIMITED') {
        const reason: CloseReason =
          err.code === 'ROOM_FULL' ? 'full' : err.code === 'FORBIDDEN' ? 'banned' : 'not_found';
        close(reason, err.message);
        return;
      }
      scheduleRetry();
      return;
    }
    if (stopped) return;

    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${scheme}://${location.host}/ws?token=${encodeURIComponent(token)}`);
    socket = ws;

    ws.onopen = () => {
      attempt = 0;
      setConnection({ kind: 'open' });
      const ping = () => sendToRoom({ t: 'ping', ts: Date.now() });
      ping();
      pingTimer = setInterval(ping, PING_INTERVAL_MS);
    };
    ws.onmessage = (event: MessageEvent<string>) => {
      let json: unknown;
      try {
        json = JSON.parse(event.data);
      } catch {
        return;
      }
      const parsed = ServerMessage.safeParse(json);
      if (parsed.success) handleMessage(parsed.data);
    };
    ws.onclose = (event) => {
      clearInterval(pingTimer);
      if (socket === ws) socket = null;
      if (stopped) return;
      const final = FINAL_CLOSES[event.code];
      if (final) close(final[0], final[1]);
      else scheduleRetry(); // network blip, server restart (1012), heartbeat timeout…
    };
  };

  void open();

  return () => {
    stopped = true;
    clearInterval(pingTimer);
    clearTimeout(retryTimer);
    socket?.close(1000, 'left');
    socket = null;
    close('left', 'You left the room.');
  };
}

/** Sends an intent to the room. Dropped when not connected (the UI disables controls then). */
export function sendToRoom(msg: ClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

/** For the drawer: apply locally right away (input-to-ink < 16 ms), then send. */
export function drawAndSend(op: DrawOp & ClientMessage): void {
  strokeModel.apply(op);
  sendToRoom(op);
}
