import {
  generateRoomCode,
  hasProfanity,
  normalizeRoomCode,
  type Rng,
} from '@pictiotheme/game-core';
import {
  CloseCode,
  type Card,
  type JoinRoomResponse,
  type PlayerIdentity,
} from '@pictiotheme/protocol';
import type { TowerServerMessage } from '@pictiotheme/protocol/tower';
import { createTowerRoomState } from '@pictiotheme/tower-core';
import type { Db } from '../../db/client';
import { playerIdOf, type Actor } from '../../lib/actor';
import { AppError, conflict, serviceUnavailable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import { TOWER_AUDIENCE, type AuthService } from '../auth';
import type { AvatarsService } from '../avatars';
import type { RoomTransport } from '../rooms';
import type { PhysicsPool } from './physics/physics-pool';
import { TowerRoomRuntime } from './tower-room-runtime';
import * as repo from './tower.repository';

/** Two crews of six at most (game-rules.md#crews). */
const MAX_PLAYERS = 12;
/** Tower Mix is read again after this, so a deck switched on or off shows up. */
const WORDS_CACHE_MS = 10 * 60_000;

function cryptoRng(): number {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value / 2 ** 32;
}

function assertAllowedName(name: string): void {
  if (hasProfanity(name)) {
    throw new AppError('VALIDATION', 400, "That name isn't allowed. Please pick another one.");
  }
}

/**
 * Owns live Doodle Tower rooms: creating, joining, shutdown. Each room is a TowerRoomRuntime
 * around the pure tower-core state machine. Same identity and join tokens as DoodleWhirl, with
 * their own audience.
 */
export function createTowerService(deps: {
  db: Db;
  auth: AuthService;
  avatars: AvatarsService;
  transport: RoomTransport;
  physics: PhysicsPool;
  log: Logger;
  now?: () => number;
  rng?: Rng;
}) {
  const now = deps.now ?? Date.now;
  const rng = deps.rng ?? cryptoRng;
  const rooms = new Map<string, TowerRoomRuntime>();
  let accepting = true;
  let words: { cards: Card[]; at: number } | null = null;

  async function loadWords(): Promise<Card[]> {
    if (words && now() - words.at < WORDS_CACHE_MS) return words.cards;
    const cards = await repo.towerMixWords(deps.db);
    words = { cards, at: now() };
    return cards;
  }

  function roomByCode(rawCode: string): TowerRoomRuntime {
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

  async function issueToken(room: TowerRoomRuntime, actor: Actor, identity: PlayerIdentity) {
    const avatar = await deps.avatars.store(identity.avatar);
    return deps.auth.issueJoinToken(
      {
        roomCode: room.code,
        playerId: playerIdOf(actor),
        displayName: identity.displayName,
        avatar,
        isRegistered: actor.kind === 'user',
      },
      TOWER_AUDIENCE,
    );
  }

  /** One hosted room per player: an empty earlier one is closed, a busy one blocks a new one. */
  function releasePreviousRoom(hostId: string): void {
    for (const room of rooms.values()) {
      if (room.state.hostId !== hostId) continue;
      const others = [...room.state.players.values()].some((p) => p.connected && p.id !== hostId);
      if (others) throw conflict('You are already hosting a room with players in it');
      room.dispose();
    }
  }

  return {
    async createRoom(actor: Actor, identity: PlayerIdentity): Promise<JoinRoomResponse> {
      if (!accepting) throw serviceUnavailable('The server is restarting');
      assertAllowedName(identity.displayName);
      const hostId = playerIdOf(actor);
      releasePreviousRoom(hostId);
      let code = generateRoomCode(rng);
      while (rooms.has(code)) code = generateRoomCode(rng);
      const log = deps.log.child({ roomCode: code, game: 'tower' });
      const room = new TowerRoomRuntime(createTowerRoomState({ code, hostId, now: now() }), {
        transport: deps.transport,
        physics: deps.physics,
        loadWords,
        onMatchEnded: (roomCode, ended) => {
          log.info(
            { winner: ended.results.winner, reason: ended.results.reason },
            'tower match ended',
          );
          repo
            .insertMatch(deps.db, {
              roomCode,
              settings: { ...room.state.settings },
              results: ended.results,
              startedAt: new Date(ended.startedAt),
              endedAt: new Date(ended.endedAt),
            })
            .catch((err: unknown) => log.error({ err }, 'saving a tower match failed'));
        },
        onClosed: (closedCode) => {
          rooms.delete(closedCode);
          log.info('tower room closed');
        },
        log,
        now,
        rng,
      });
      rooms.set(code, room);
      room.handle({ type: 'init' });
      log.info('tower room created');
      return { code, joinToken: await issueToken(room, actor, identity) };
    },

    lookup(rawCode: string): { code: string } {
      return { code: roomByCode(rawCode).code };
    },

    async joinRoom(
      actor: Actor,
      rawCode: string,
      identity: PlayerIdentity,
    ): Promise<JoinRoomResponse> {
      const room = roomByCode(rawCode);
      assertAllowedName(identity.displayName);
      const { players } = room.state;
      if (!players.has(playerIdOf(actor)) && players.size >= MAX_PLAYERS) {
        throw new AppError('ROOM_FULL', 409, 'This room is full');
      }
      return { code: room.code, joinToken: await issueToken(room, actor, identity) };
    },

    getRoom(code: string): TowerRoomRuntime | undefined {
      return rooms.get(code);
    },

    /** Graceful shutdown: tell every player, then close every room. */
    shutdown(): void {
      accepting = false;
      const notice: TowerServerMessage = { t: 'server:restarting' };
      for (const room of [...rooms.values()]) {
        deps.transport.send(room.code, [...room.state.players.keys()], JSON.stringify(notice));
        room.dispose(CloseCode.serviceRestart, 'Server restarting');
      }
    },
  };
}

export type TowerService = ReturnType<typeof createTowerService>;
