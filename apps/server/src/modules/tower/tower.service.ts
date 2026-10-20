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
import {
  DEFAULT_TOWER_SETTINGS,
  type CreateTowerRoomRequest,
  type TowerServerMessage,
} from '@pictiotheme/protocol/tower';
import { createTowerRoomState } from '@pictiotheme/tower-core';
import type { Db } from '../../db/client';
import { playerIdOf, type Actor } from '../../lib/actor';
import { AppError, conflict, serviceUnavailable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import { contentIdOf } from '../../lib/png';
import { TOWER_AUDIENCE, type AuthService } from '../auth';
import type { AvatarsService } from '../avatars';
import type { RoomTransport } from '../rooms';
import type { PhysicsPool } from './physics/physics-pool';
import { TowerRoomRuntime } from './tower-room-runtime';
import * as repo from './tower.repository';
import {
  renderTowerShareCard,
  TOWER_SHARE_CARD_REVISION,
  towerShareEmbedHtml,
} from './tower-share-card';

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
  /** Where Doodle Tower is served, for the share card's links. */
  publicOrigin: string;
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

  /** "Ana's tower": rooms have no name of their own, so they go by their host's. */
  function roomName(room: TowerRoomRuntime): string {
    const host = room.state.players.get(room.state.hostId)?.name ?? room.creatorName;
    return `${host}'s tower`;
  }

  /** Changes whenever something the share card shows changes. */
  function shareCardVersion(room: TowerRoomRuntime): string {
    const { line, roundSeconds, steals } = room.state.settings;
    const shown = [
      TOWER_SHARE_CARD_REVISION,
      room.code,
      roomName(room),
      line,
      roundSeconds,
      steals,
    ];
    return contentIdOf(Buffer.from(JSON.stringify(shown))).slice(0, 12);
  }

  const service = {
    async createRoom(actor: Actor, request: CreateTowerRoomRequest): Promise<JoinRoomResponse> {
      if (!accepting) throw serviceUnavailable('The server is restarting');
      const { isPublic = false, ...identity } = request;
      assertAllowedName(identity.displayName);
      const hostId = playerIdOf(actor);
      releasePreviousRoom(hostId);
      let code = generateRoomCode(rng);
      while (rooms.has(code)) code = generateRoomCode(rng);
      const log = deps.log.child({ roomCode: code, game: 'tower' });
      const settings = { ...DEFAULT_TOWER_SETTINGS, isPublic };
      const state = createTowerRoomState({ code, hostId, now: now(), settings });
      const room = new TowerRoomRuntime(state, identity.displayName, {
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
      log.info({ isPublic }, 'tower room created');
      return { code, joinToken: await issueToken(room, actor, identity) };
    },

    /**
     * Quick game: the public room with space that is waiting and has the most players; failing
     * that, the fullest public match with space (newcomers join the smaller crew); failing that, a
     * new public room hosted by the player.
     */
    async quickPlay(actor: Actor, identity: PlayerIdentity): Promise<JoinRoomResponse> {
      if (!accepting) throw serviceUnavailable('The server is restarting');
      assertAllowedName(identity.displayName);
      const playerId = playerIdOf(actor);
      const candidates = [...rooms.values()].flatMap((room) => {
        const { settings, players, phase } = room.state;
        const connected = [...players.values()].filter((p) => p.connected).length;
        const hasSpace = players.has(playerId) || players.size < MAX_PLAYERS;
        return settings.isPublic && connected > 0 && hasSpace ? [{ room, phase, connected }] : [];
      });
      candidates.sort(
        (a, b) =>
          Number(a.phase !== 'waiting') - Number(b.phase !== 'waiting') ||
          b.connected - a.connected,
      );
      const [best] = candidates;
      if (best) return service.joinRoom(actor, best.room.code, identity);
      return service.createRoom(actor, { ...identity, isPublic: true });
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

    /**
     * The room's share card and its version, drawn again only when what it shows changed. Anyone
     * with the code may see it, like the room itself.
     */
    async shareCard(rawCode: string): Promise<{ version: string; png: Buffer }> {
      const room = roomByCode(rawCode);
      const version = shareCardVersion(room);
      if (room.shareCard?.version === version) return room.shareCard;
      const { settings } = room.state;
      const png = await renderTowerShareCard({
        code: room.code,
        name: roomName(room),
        host: new URL(deps.publicOrigin).host,
        line: settings.line,
        roundSeconds: settings.roundSeconds,
        steals: settings.steals,
      });
      room.shareCard = { version, png };
      return room.shareCard;
    },

    /** The page link preview bots get for an invite link: Open Graph tags around the card. */
    shareEmbed(rawCode: string): string {
      const room = roomByCode(rawCode);
      return towerShareEmbedHtml({
        origin: deps.publicOrigin,
        code: room.code,
        name: roomName(room),
        line: room.state.settings.line,
        imageVersion: shareCardVersion(room),
      });
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
  return service;
}

export type TowerService = ReturnType<typeof createTowerService>;
