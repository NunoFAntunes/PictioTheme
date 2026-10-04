import websocket from '@fastify/websocket';
import {
  ClientMessage,
  CloseCode,
  type ErrorCode,
  type ServerMessage,
} from '@pictiotheme/protocol';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { RawData, WebSocket } from 'ws';
import { z } from 'zod';
import { AppError, unauthenticated } from '../../lib/errors';
import type { AuthService, JoinClaims } from '../auth';
import type { RoomsService } from '../rooms';
import type { ConnectionRegistry } from './connections';
import { createMessageLimiter } from './message-limiter';

/**
 * The WebSocket endpoint: authenticate the upgrade with the join token (R10), decode and
 * validate every message (R4), rate-limit (R5), heartbeat (R8), and hand events to the room.
 */

const MAX_PAYLOAD_BYTES = 16 * 1024;
const HEARTBEAT_MS = 20_000;
const STRIKE_WINDOW_MS = 60_000;
const MAX_STRIKES = 10;

declare module 'fastify' {
  interface FastifyRequest {
    joinClaims: JoinClaims | null;
  }
}

function sendDirect(socket: WebSocket, msg: ServerMessage): void {
  socket.send(JSON.stringify(msg));
}

function rawToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  return Buffer.from(new Uint8Array(data)).toString('utf8');
}

export const realtimeGateway: FastifyPluginAsyncZod<{
  rooms: RoomsService;
  auth: AuthService;
  connections: ConnectionRegistry;
}> = async (app, { rooms, auth, connections }) => {
  await app.register(websocket, { options: { maxPayload: MAX_PAYLOAD_BYTES } });
  app.decorateRequest('joinClaims', null);

  // Sockets that miss a heartbeat are terminated; the room sees a disconnect.
  const alive = new WeakMap<WebSocket, boolean>();
  const heartbeat = setInterval(() => {
    for (const socket of app.websocketServer.clients) {
      if (alive.get(socket) === false) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();
  app.addHook('onClose', async () => clearInterval(heartbeat));

  app.get(
    '/ws',
    {
      websocket: true,
      schema: { querystring: z.object({ token: z.string().min(1).max(4096) }) },
      // Runs before the upgrade: a bad token never gets a socket.
      preHandler: async (request) => {
        const claims = await auth.verifyJoinToken(request.query.token);
        if (!claims) throw unauthenticated();
        if (!rooms.getRoom(claims.roomCode)) {
          throw new AppError('ROOM_NOT_FOUND', 404, 'No room with that code');
        }
        request.joinClaims = claims;
      },
    },
    (socket, request) => {
      const claims = request.joinClaims;
      const room = claims ? rooms.getRoom(claims.roomCode) : undefined;
      if (!claims || !room) {
        socket.close(CloseCode.roomClosed, 'Room closed');
        return;
      }
      const { roomCode, playerId } = claims;
      const log = request.log.child({ roomCode, playerId });

      alive.set(socket, true);
      socket.on('pong', () => alive.set(socket, true));
      connections.attach(roomCode, playerId, socket);
      room.handle({
        type: 'join',
        player: {
          id: playerId,
          name: claims.displayName,
          avatar: claims.avatar,
          isRegistered: claims.isRegistered,
        },
      });

      const limiter = createMessageLimiter();
      const strikes: number[] = [];
      const strike = (code: ErrorCode, message: string) => {
        const now = Date.now();
        strikes.push(now);
        while (strikes.length > 0 && (strikes[0] ?? now) < now - STRIKE_WINDOW_MS) strikes.shift();
        if (strikes.length >= MAX_STRIKES) {
          log.warn('closing socket after repeated invalid messages');
          socket.close(CloseCode.policy, 'Too many invalid messages');
          return;
        }
        sendDirect(socket, { t: 'error', code, message });
      };

      socket.on('message', (data, isBinary) => {
        if (isBinary) {
          strike('VALIDATION', 'Binary messages are not supported');
          return;
        }
        let json: unknown;
        try {
          json = JSON.parse(rawToString(data));
        } catch {
          strike('VALIDATION', 'Messages must be JSON');
          return;
        }
        const parsed = ClientMessage.safeParse(json);
        if (!parsed.success) {
          strike('VALIDATION', 'Invalid message');
          return;
        }
        if (!limiter.allow(parsed.data.t)) {
          sendDirect(socket, { t: 'error', code: 'RATE_LIMITED', message: 'Slow down' });
          return;
        }
        room.handle({ type: 'message', playerId, msg: parsed.data });
      });

      socket.on('close', () => {
        if (connections.detach(roomCode, playerId, socket)) {
          room.handle({ type: 'disconnect', playerId });
        }
      });
      socket.on('error', (err) => log.warn({ err }, 'socket error'));
    },
  );
};
