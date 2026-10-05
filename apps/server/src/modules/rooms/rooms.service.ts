import {
  createRoomState,
  generateRoomCode,
  hasProfanity,
  normalizeRoomCode,
  type Rng,
} from '@pictiotheme/game-core';
import {
  CloseCode,
  DEFAULT_ROOM_SETTINGS,
  ROOM_COVER_HEIGHT_PX,
  ROOM_COVER_MAX_BYTES,
  ROOM_COVER_WIDTH_PX,
  type AvatarId,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type JoinRoomResponse,
  type QuickPlayRequest,
  type RoomCoverUpload,
  type UpdateIdentityRequest,
  type PublicRoomSummary,
  type ServerMessage,
} from '@pictiotheme/protocol';
import { playerIdOf, type Actor } from '../../lib/actor';
import { AppError, conflict, notFound, serviceUnavailable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import { decodePngDataUrl } from '../../lib/png';
import type { AuthService } from '../auth';
import type { MetricsService } from '../metrics';
import type { AvatarsService } from '../avatars';
import type { DecksService } from '../decks';
import { RoomRuntime } from './room-runtime';
import type { RoomTransport } from './room-transport';

const MAX_PUBLIC_ROOMS_LISTED = 50;

/** Crypto-backed randomness for room codes and shuffles. */
function cryptoRng(): number {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value / 2 ** 32;
}

/**
 * Owns live rooms: creation, joining, the lobby list, shutdown.
 * Each room is a `RoomRuntime` around the pure game-core state machine.
 */
/** Names are shown to strangers in public rooms: refuse profanity (security-and-moderation.md). */
function assertAllowed(text: string, what: 'name' | 'room name'): void {
  if (hasProfanity(text)) {
    throw new AppError('VALIDATION', 400, `That ${what} isn't allowed. Please pick another one.`);
  }
}

export function createRoomsService(deps: {
  decks: DecksService;
  auth: AuthService;
  avatars: AvatarsService;
  metrics: MetricsService;
  transport: RoomTransport;
  log: Logger;
  now?: () => number;
  rng?: Rng;
}) {
  const now = deps.now ?? Date.now;
  const rng = deps.rng ?? cryptoRng;
  const rooms = new Map<string, RoomRuntime>();
  let accepting = true;

  function roomByCode(rawCode: string): RoomRuntime {
    const normalized = normalizeRoomCode(rawCode);
    if (!normalized.ok) {
      if (normalized.reason === 'ambiguous_letters') {
        throw new AppError(
          'ROOM_CODE_AMBIGUOUS_LETTERS',
          400,
          'Codes never contain I or O, so check the letters',
        );
      }
      throw new AppError('ROOM_NOT_FOUND', 404, 'No room with that code');
    }
    const room = rooms.get(normalized.code);
    if (!room) throw new AppError('ROOM_NOT_FOUND', 404, 'No room with that code');
    return room;
  }

  function issueToken(
    room: RoomRuntime,
    actor: Actor,
    identity: { displayName: string; avatar: AvatarId },
  ) {
    return deps.auth.issueJoinToken({
      roomCode: room.code,
      playerId: playerIdOf(actor),
      displayName: identity.displayName,
      avatar: identity.avatar,
      isRegistered: actor.kind === 'user',
    });
  }

  /** Max one active hosted room per player (security-and-moderation.md: spam rooms). */
  function releasePreviousRoom(hostId: string): void {
    for (const room of rooms.values()) {
      if (room.state.hostId !== hostId) continue;
      const othersConnected = [...room.state.players.values()].some(
        (p) => p.connected && p.id !== hostId,
      );
      if (othersConnected) throw conflict('You are already hosting a room with players in it');
      room.dispose();
    }
  }

  const service = {
    async createRoom(actor: Actor, input: CreateRoomRequest): Promise<JoinRoomResponse> {
      if (!accepting) throw serviceUnavailable('The server is restarting');
      assertAllowed(input.displayName, 'name');
      assertAllowed(input.name, 'room name');
      const deckId = input.deckId ?? (await deps.decks.defaultDeckId());
      if (!deckId || !(await deps.decks.exists(deckId))) throw notFound('Deck');
      // Stored before the room exists, so an invalid avatar doesn't leave an empty room behind.
      const avatar = await deps.avatars.store(input.avatar);
      const hostId = playerIdOf(actor);
      releasePreviousRoom(hostId);

      let code = generateRoomCode(rng);
      while (rooms.has(code)) code = generateRoomCode(rng);

      const log = deps.log.child({ roomCode: code });
      const room = new RoomRuntime(
        createRoomState({
          code,
          name: input.name,
          isPublic: input.isPublic,
          hostId,
          settings: { ...DEFAULT_ROOM_SETTINGS, deckId },
          now: now(),
        }),
        {
          transport: deps.transport,
          loadDeck: (id) => deps.decks.getPlayableDeck(id),
          onMetric: (roomCode, effect) => {
            if (effect.kind === 'matchEnded') log.info({ summary: effect.summary }, 'match ended');
            deps.metrics.onRoomEffect(roomCode, effect);
          },
          onClosed: (closedCode) => {
            rooms.delete(closedCode);
            log.info('room closed');
          },
          log,
          now,
          rng,
        },
      );
      rooms.set(code, room);
      room.handle({ type: 'init' });
      log.info({ isPublic: input.isPublic }, 'room created');
      deps.metrics.record({
        name: 'room_created',
        playerId: hostId,
        roomCode: code,
        deckId,
        props: { isPublic: input.isPublic },
      });
      return {
        code,
        joinToken: await issueToken(room, actor, { displayName: input.displayName, avatar }),
      };
    },

    async joinRoom(
      actor: Actor,
      rawCode: string,
      identity: JoinRoomRequest,
    ): Promise<JoinRoomResponse> {
      const room = roomByCode(rawCode);
      assertAllowed(identity.displayName, 'name');
      const playerId = playerIdOf(actor);
      const { state } = room;
      if (state.banned.has(playerId))
        throw new AppError('FORBIDDEN', 403, 'You were removed from this room');
      if (!state.players.has(playerId) && state.players.size >= state.settings.maxPlayers) {
        throw new AppError('ROOM_FULL', 409, 'This room is full');
      }
      const avatar = await deps.avatars.store(identity.avatar);
      return {
        code: room.code,
        joinToken: await issueToken(room, actor, { displayName: identity.displayName, avatar }),
      };
    },

    /**
     * Joins the public room with space that is waiting and has the most players; failing that, the
     * fullest public match with space (joined as a guesser); failing that, creates a public room
     * named after the player (user-flows.md §2).
     */
    async quickPlay(actor: Actor, identity: QuickPlayRequest): Promise<JoinRoomResponse> {
      if (!accepting) throw serviceUnavailable('The server is restarting');
      assertAllowed(identity.displayName, 'name');
      const playerId = playerIdOf(actor);
      const [best] = [...rooms.values()]
        .filter(({ state }) => {
          const connected = [...state.players.values()].some((p) => p.connected);
          const hasSpace =
            state.players.has(playerId) || state.players.size < state.settings.maxPlayers;
          return state.isPublic && connected && hasSpace && !state.banned.has(playerId);
        })
        .map((room) => ({ room, summary: room.summary() }))
        .sort(
          (a, b) =>
            Number(a.summary.status === 'playing') - Number(b.summary.status === 'playing') ||
            b.summary.players - a.summary.players,
        );
      if (best) return service.joinRoom(actor, best.room.code, identity);
      return service.createRoom(actor, {
        ...identity,
        name: `${identity.displayName}'s room`,
        isPublic: true,
      });
    },

    /**
     * A player already in the room changes their name or avatar. Checked and stored like a join;
     * the room tells everyone (user-flows.md §5).
     */
    async updateIdentity(
      actor: Actor,
      rawCode: string,
      identity: UpdateIdentityRequest,
    ): Promise<void> {
      const room = roomByCode(rawCode);
      assertAllowed(identity.displayName, 'name');
      const playerId = playerIdOf(actor);
      if (!room.state.players.has(playerId)) {
        throw new AppError('FORBIDDEN', 403, 'You are not in this room');
      }
      const avatar = await deps.avatars.store(identity.avatar);
      room.handle({ type: 'identity', playerId, name: identity.displayName, avatar });
    },

    /**
     * The drawer's picture of a drawing that beat the room's cover (game-rules.md, likes). Only the
     * drawing the room asked for (`cover:request`), from its drawer; anything else is stale.
     */
    uploadCover(actor: Actor, rawCode: string, upload: RoomCoverUpload): { accepted: boolean } {
      const room = roomByCode(rawCode);
      const pending = room.state.pendingCover;
      if (!pending || pending.turn !== upload.turn || pending.drawerId !== playerIdOf(actor)) {
        return { accepted: false };
      }
      const png = decodePngDataUrl(upload.image, {
        width: ROOM_COVER_WIDTH_PX,
        height: ROOM_COVER_HEIGHT_PX,
        maxBytes: ROOM_COVER_MAX_BYTES,
      });
      if (!png) {
        throw new AppError(
          'VALIDATION',
          400,
          `Room covers must be ${ROOM_COVER_WIDTH_PX}×${ROOM_COVER_HEIGHT_PX} PNG images`,
        );
      }
      room.coverPng = png;
      room.handle({ type: 'coverStored', turn: upload.turn });
      return { accepted: true };
    },

    coverPng(rawCode: string): Buffer | null {
      return roomByCode(rawCode).coverPng;
    },

    /** Players connected right now, across every room. */
    onlineCount(): number {
      let count = 0;
      for (const room of rooms.values()) {
        for (const player of room.state.players.values()) if (player.connected) count++;
      }
      return count;
    },

    listPublic(): PublicRoomSummary[] {
      // Only rooms someone is in right now (not ones whose players are all reconnecting).
      return [...rooms.values()]
        .filter((r) => r.state.isPublic)
        .map((r) => r.summary())
        .filter((summary) => summary.players > 0)
        .sort(
          (a, b) =>
            Number(a.status === 'playing') - Number(b.status === 'playing') ||
            b.players - a.players,
        )
        .slice(0, MAX_PUBLIC_ROOMS_LISTED);
    },

    getRoom(code: string): RoomRuntime | undefined {
      return rooms.get(code);
    },

    /** Graceful shutdown: tell every player, then close every room (backend-guidelines.md). */
    shutdown(): void {
      accepting = false;
      const notice: ServerMessage = { t: 'server:restarting' };
      for (const room of [...rooms.values()]) {
        deps.transport.send(room.code, [...room.state.players.keys()], JSON.stringify(notice));
        room.dispose(CloseCode.serviceRestart, 'Server restarting');
      }
    },
  };
  return service;
}

export type RoomsService = ReturnType<typeof createRoomsService>;
