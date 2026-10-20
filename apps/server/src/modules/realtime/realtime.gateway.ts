import websocket from '@fastify/websocket';
import { ClientMessage, CloseCode, type ErrorCode } from '@pictiotheme/protocol';
import { TowerClientMessage } from '@pictiotheme/protocol/tower';
import type { FastifyBaseLogger } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { RawData, WebSocket } from 'ws';
import { z } from 'zod';
import { AppError, unauthenticated } from '../../lib/errors';
import { TOWER_AUDIENCE, type AuthService, type JoinClaims } from '../auth';
import type { RoomsService } from '../rooms';
import type { TowerService } from '../tower';
import type { ConnectionRegistry } from './connections';
import { createMessageLimiter, createTowerMessageLimiter } from './message-limiter';

/**
 * The WebSocket endpoints, DoodleWhirl's (`/ws`) and Doodle Tower's (`/ws/tower`): authenticate
 * the upgrade with the join token (R10), decode and validate every message (R4), rate-limit (R5),
 * heartbeat (R8), and hand events to the room.
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

function sendError(socket: WebSocket, code: ErrorCode, message: string): void {
  socket.send(JSON.stringify({ t: 'error', code, message }));
}

function rawToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  return Buffer.from(new Uint8Array(data)).toString('utf8');
}

/**
 * One room socket's life, for either game: strikes for invalid messages (R4), the rate limit
 * (R5), and the room hearing about each valid message and the close.
 */
function serveSocket<T extends { t: string }>(
  socket: WebSocket,
  options: {
    log: FastifyBaseLogger;
    parse: (json: unknown) => T | null;
    allow: (type: T['t']) => boolean;
    onMessage: (msg: T) => void;
    onClose: () => void;
  },
): void {
  const strikes: number[] = [];
  const strike = (code: ErrorCode, message: string) => {
    const now = Date.now();
    strikes.push(now);
    while (strikes.length > 0 && (strikes[0] ?? now) < now - STRIKE_WINDOW_MS) strikes.shift();
    if (strikes.length >= MAX_STRIKES) {
      options.log.warn('closing socket after repeated invalid messages');
      socket.close(CloseCode.policy, 'Too many invalid messages');
      return;
    }
    sendError(socket, code, message);
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
    const msg = options.parse(json);
    if (!msg) {
      strike('VALIDATION', 'Invalid message');
      return;
    }
    if (!options.allow(msg.t)) {
      sendError(socket, 'RATE_LIMITED', 'Slow down');
      return;
    }
    options.onMessage(msg);
  });
  socket.on('close', options.onClose);
  socket.on('error', (err) => options.log.warn({ err }, 'socket error'));
}

export const realtimeGateway: FastifyPluginAsyncZod<{
  rooms: RoomsService;
  auth: AuthService;
  connections: ConnectionRegistry;
  tower: TowerService;
  towerConnections: ConnectionRegistry;
}> = async (app, { rooms, auth, connections, tower, towerConnections }) => {
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

  const token = { querystring: z.object({ token: z.string().min(1).max(4096) }) };

  app.get(
    '/ws',
    {
      websocket: true,
      schema: token,
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
      serveSocket(socket, {
        log: request.log.child({ roomCode, playerId }),
        parse: (json) => {
          const parsed = ClientMessage.safeParse(json);
          return parsed.success ? parsed.data : null;
        },
        allow: (type) => limiter.allow(type),
        onMessage: (msg) => room.handle({ type: 'message', playerId, msg }),
        onClose: () => {
          if (connections.detach(roomCode, playerId, socket)) {
            room.handle({ type: 'disconnect', playerId });
          }
        },
      });
    },
  );

  app.get(
    '/ws/tower',
    {
      websocket: true,
      schema: token,
      preHandler: async (request) => {
        const claims = await auth.verifyJoinToken(request.query.token, TOWER_AUDIENCE);
        if (!claims) throw unauthenticated();
        if (!tower.getRoom(claims.roomCode)) {
          throw new AppError('ROOM_NOT_FOUND', 404, 'No room with that code');
        }
        request.joinClaims = claims;
      },
    },
    (socket, request) => {
      const claims = request.joinClaims;
      const room = claims ? tower.getRoom(claims.roomCode) : undefined;
      if (!claims || !room) {
        socket.close(CloseCode.roomClosed, 'Room closed');
        return;
      }
      const { roomCode, playerId } = claims;
      alive.set(socket, true);
      socket.on('pong', () => alive.set(socket, true));
      towerConnections.attach(roomCode, playerId, socket);
      room.handle({
        type: 'join',
        player: { id: playerId, name: claims.displayName, avatar: claims.avatar },
      });
      const limiter = createTowerMessageLimiter();
      serveSocket(socket, {
        log: request.log.child({ roomCode, playerId, game: 'tower' }),
        parse: (json) => {
          const parsed = TowerClientMessage.safeParse(json);
          return parsed.success ? parsed.data : null;
        },
        allow: (type) => limiter.allow(type),
        onMessage: (msg) => room.handle({ type: 'message', playerId, msg }),
        onClose: () => {
          if (towerConnections.detach(roomCode, playerId, socket)) {
            room.handle({ type: 'disconnect', playerId });
          }
        },
      });
    },
  );
};
