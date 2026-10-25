import { createStrokeModel, type StrokeModel } from '@pictiotheme/canvas-engine';
import {
  CloseCode,
  GuestSessionResponse,
  JoinRoomResponse,
  type PlayerIdentity,
} from '@pictiotheme/protocol';
import {
  TEAMS,
  TowerServerMessage,
  type Team,
  type TowerClientMessage,
  type TowerDrawOp,
} from '@pictiotheme/protocol/tower';
import { ApiError, apiPost } from '../lib/api';
import { towerFrames } from './frames';
import { serverNow, useRoomStore, type CloseReason } from './room-store';
import { applyServerMessage, viewFromSnapshot } from './room-view';

/**
 * The only code that touches the WebSocket (rule W5). One room per tab. Every (re)connect asks
 * for a fresh join token first: tokens live 60 seconds.
 */

/** Each crew's current drawing, rendered by the drawing feature. */
export const strokeModels: Record<Team, StrokeModel> = {
  orange: createStrokeModel(),
  teal: createStrokeModel(),
};

const PING_INTERVAL_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 8;

const FINAL_CLOSES: Record<number, [CloseReason, string]> = {
  [CloseCode.replaced]: ['replaced', 'This room is open in another tab.'],
  [CloseCode.roomClosed]: ['room_closed', 'This room has closed.'],
  [CloseCode.policy]: ['lost', 'The connection was closed.'],
};

let socket: WebSocket | null = null;

function close(reason: CloseReason, message: string) {
  useRoomStore.setState({ connection: { kind: 'closed', reason, message } });
}

function handleMessage(msg: TowerServerMessage): void {
  switch (msg.t) {
    case 'pong':
      // Halfway through the round trip, the server's clock read serverTime.
      useRoomStore.setState({ clockOffset: msg.serverTime - (msg.ts + Date.now()) / 2 });
      return;
    case 'crew:draw':
      strokeModels[msg.team].apply(msg.op);
      return;
    case 'tower:frame':
      towerFrames[msg.tower].apply(msg.bodies, performance.now());
      return;
    case 'room:snapshot': {
      // The server follows a (re)join's snapshot with each tower's current poses.
      for (const team of TEAMS) {
        strokeModels[team].reset(msg.crews[team].round?.strokes ?? []);
        towerFrames[team].clear();
      }
      const { view } = useRoomStore.getState();
      useRoomStore.setState({ view: viewFromSnapshot(msg, view) });
      return;
    }
    default: {
      const { view } = useRoomStore.getState();
      if (!view) return;
      if (msg.t === 'round:start') strokeModels[msg.team].reset(msg.round.strokes);
      if (msg.t === 'tower:fumble') towerFrames[msg.tower].remove(msg.pieceIds);
      // The magpie has it now: it's drawn in its feet.
      if (msg.t === 'piece:magpied') towerFrames[msg.from].remove([msg.pieceId]);
      useRoomStore.setState({ view: applyServerMessage(view, msg, serverNow()) });
    }
  }
}

/** Connects to a room and keeps the connection alive. Returns a function that leaves. */
export function connectRoom(code: string, identity: () => PlayerIdentity): () => void {
  let stopped = false;
  let attempt = 0;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  useRoomStore.setState({ view: null, connection: { kind: 'connecting' } });
  for (const team of TEAMS) {
    strokeModels[team].reset([]);
    towerFrames[team].clear();
  }

  const scheduleRetry = () => {
    attempt += 1;
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      close('lost', 'Lost connection to the server.');
      return;
    }
    useRoomStore.setState({ connection: { kind: 'reconnecting', attempt } });
    const delay = Math.min(10_000, 500 * 2 ** attempt) + Math.random() * 300;
    retryTimer = setTimeout(() => void open(), delay);
  };

  const open = async () => {
    if (stopped) return;
    let token: string;
    try {
      await apiPost('/api/session/guest', undefined, GuestSessionResponse);
      token = (
        await apiPost(
          `/api/tower/rooms/${encodeURIComponent(code)}/join`,
          identity(),
          JoinRoomResponse,
        )
      ).joinToken;
    } catch (err) {
      if (stopped) return;
      if (err instanceof ApiError && err.status < 500 && err.code !== 'RATE_LIMITED') {
        close(err.code === 'ROOM_FULL' ? 'full' : 'not_found', err.message);
        return;
      }
      scheduleRetry();
      return;
    }
    if (stopped) return;

    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      `${scheme}://${location.host}/ws/tower?token=${encodeURIComponent(token)}`,
    );
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      useRoomStore.setState({ connection: { kind: 'open' } });
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
      const parsed = TowerServerMessage.safeParse(json);
      if (parsed.success) handleMessage(parsed.data);
    };
    ws.onclose = (event) => {
      clearInterval(pingTimer);
      if (socket === ws) socket = null;
      if (stopped) return;
      const final = FINAL_CLOSES[event.code];
      if (final) close(final[0], final[1]);
      else scheduleRetry(); // a network blip, a server restart (1012), a missed heartbeat…
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
export function sendToRoom(msg: TowerClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

/** For the drawer: apply to their crew's drawing right away, then send. */
export function drawAndSend(team: Team, op: TowerDrawOp): void {
  strokeModels[team].apply(op);
  sendToRoom(op);
}
