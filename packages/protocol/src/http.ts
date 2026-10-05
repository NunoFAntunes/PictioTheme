import { z } from 'zod';
import { DeckCoverId, DeckCoverImage, Difficulty } from './deck';
import { AvatarImage, DisplayName, RoomCode, RoomCoverImage, RoomName } from './room';

/** REST DTOs shared by the server and the web app. */

export const HealthResponse = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ReadyResponse = z.object({
  status: z.literal('ready'),
  checks: z.object({
    database: z.literal('ok'),
  }),
});
export type ReadyResponse = z.infer<typeof ReadyResponse>;

// ── Session ──

export const GuestSessionResponse = z.object({
  playerId: z.string(),
});
export type GuestSessionResponse = z.infer<typeof GuestSessionResponse>;

// ── Rooms ──

/** Who the player is in a room. Chosen per room, so guests and accounts work the same way. */
export const PlayerIdentity = z.object({
  displayName: DisplayName,
  /** The drawn avatar. The server stores it and players see it by id (`PublicPlayer.avatar`). */
  avatar: AvatarImage,
});
export type PlayerIdentity = z.infer<typeof PlayerIdentity>;

export const CreateRoomRequest = PlayerIdentity.extend({
  name: RoomName,
  isPublic: z.boolean(),
  deckId: z.string().min(1).optional(),
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequest>;

export const JoinRoomRequest = PlayerIdentity;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequest>;

/** A player in a room changes their name or avatar ("Draw yourself!", user-flows.md §5). */
export const UpdateIdentityRequest = PlayerIdentity;
export type UpdateIdentityRequest = z.infer<typeof UpdateIdentityRequest>;
export const UpdateIdentityResponse = z.object({ ok: z.literal(true) });
export type UpdateIdentityResponse = z.infer<typeof UpdateIdentityResponse>;

/** The drawer's picture of the drawing the server asked for (`cover:request`). */
export const RoomCoverUpload = z.object({ turn: z.number().int(), image: RoomCoverImage });
export type RoomCoverUpload = z.infer<typeof RoomCoverUpload>;
/** False when the request is stale (another drawing got more likes, or it's already stored). */
export const RoomCoverUploadResponse = z.object({ accepted: z.boolean() });
export type RoomCoverUploadResponse = z.infer<typeof RoomCoverUploadResponse>;

/** Quick play: the server picks a public room with space, or creates one (user-flows.md §2). */
export const QuickPlayRequest = PlayerIdentity;
export type QuickPlayRequest = z.infer<typeof QuickPlayRequest>;

/** Returned by create and join. The token is short-lived: connect to `/ws?token=…` right away. */
export const JoinRoomResponse = z.object({
  code: RoomCode,
  joinToken: z.string(),
});
export type JoinRoomResponse = z.infer<typeof JoinRoomResponse>;

export const PublicRoomSummary = z.object({
  code: RoomCode,
  name: z.string(),
  deckTitle: z.string().nullable(),
  players: z.number().int(),
  maxPlayers: z.number().int(),
  status: z.enum(['waiting', 'playing']),
  difficulties: z.array(Difficulty),
  silly: z.boolean(),
  /** Bumped each time the room gets a new cover (`GET /api/rooms/:code/cover?v=…`); null: none yet. */
  coverVersion: z.number().int().nullable(),
});
export type PublicRoomSummary = z.infer<typeof PublicRoomSummary>;

export const PublicRoomsResponse = z.object({
  rooms: z.array(PublicRoomSummary),
  /** Players connected right now, in every room (public and private). */
  online: z.number().int(),
});
export type PublicRoomsResponse = z.infer<typeof PublicRoomsResponse>;

// ── Decks ──

export const DeckSummary = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  /** The drawn back cover, or null for the default cover (no drawing yet, skipped, or hidden). */
  coverId: DeckCoverId.nullable(),
  /** A curated deck in the featured row (seasonal ones first). */
  featured: z.boolean(),
  counts: z.object({
    easy: z.number().int(),
    medium: z.number().int(),
    hard: z.number().int(),
    silly: z.number().int(),
  }),
});
export type DeckSummary = z.infer<typeof DeckSummary>;

export const DeckListResponse = z.object({ decks: z.array(DeckSummary) });

/** `GET /api/decks?q=`: search titles and tags. Without `q`, the curated decks, featured first. */
export const DeckListQuery = z.object({ q: z.string().trim().max(60).optional() });
export type DeckListQuery = z.infer<typeof DeckListQuery>;
export type DeckListResponse = z.infer<typeof DeckListResponse>;

// ── Deck generation ──

/**
 * Whether this server lets players generate decks, and how many this player has left. `daily`
 * is null when the server has no limits (development) or the player has no session yet.
 */
export const GenerationConfigResponse = z.object({
  enabled: z.boolean(),
  daily: z
    .object({
      limit: z.number().int(),
      remaining: z.number().int(),
      /** When the next deck becomes available, if none are left. */
      nextAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});
export type GenerationConfigResponse = z.infer<typeof GenerationConfigResponse>;

export const GenerationStatus = z.enum(['running', 'published', 'failed']);
export type GenerationStatus = z.infer<typeof GenerationStatus>;

/** One deck generation, polled by its creator until it's `published` or `failed`. */
export const GenerationJob = z.object({
  id: z.string(),
  status: GenerationStatus,
  theme: z.string(),
  /** A message for the player when `failed`. */
  error: z.string().nullable(),
  /** The new deck when `published`. */
  deck: DeckSummary.nullable(),
  createdAt: z.iso.datetime(),
});
export type GenerationJob = z.infer<typeof GenerationJob>;

/**
 * `PUT /api/decks/generations/:id/cover`: the creator's drawn back cover. Accepted while the
 * job runs or after it's published, so drawing never has to race the model. The same body
 * redraws a published deck's cover with `PUT /api/decks/:id/cover`.
 */
export const SetDeckCoverRequest = z.object({ image: DeckCoverImage });
export type SetDeckCoverRequest = z.infer<typeof SetDeckCoverRequest>;

// ── Deck reports ──

/**
 * Decks saved in the database have uuid ids. Built-in decks live in code with other ids, so
 * they can't be reported or have their cover redrawn.
 */
export const SavedDeckId = z.uuid();

/** What a player reports about a deck: its drawn back cover, or its cards and title. */
export const DeckReportReason = z.enum(['cover', 'content']);
export type DeckReportReason = z.infer<typeof DeckReportReason>;

/** `POST /api/decks/:id/reports`. Enough reports from different players hide the cover or the deck. */
export const ReportDeckRequest = z.object({ reason: DeckReportReason });
export type ReportDeckRequest = z.infer<typeof ReportDeckRequest>;

/** The reporter only learns that the report arrived, not whether it hid anything. */
export const ReportDeckResponse = z.object({ received: z.literal(true) });
export type ReportDeckResponse = z.infer<typeof ReportDeckResponse>;

// ── Product events ──

/** How the player's device is classed for metrics (phones only reach the app via "Try anyway"). */
export const DeviceKind = z.enum(['desktop', 'tablet', 'phone']);
export type DeviceKind = z.infer<typeof DeviceKind>;

/**
 * `POST /api/events`: what only the browser knows, for the launch metrics
 * (docs/planning/next-features.md, "What to measure at launch"). Never personal data.
 */
export const ClientEvent = z.discriminatedUnion('name', [
  /** The first turn this tab saw start, and how long after the page first loaded. */
  z.object({
    name: z.literal('first_turn'),
    msSinceLanding: z
      .number()
      .int()
      .min(0)
      .max(24 * 3600_000),
    /** Arrived through an invite link (`/r/…`) rather than the lobby. */
    viaLink: z.boolean(),
  }),
  /** A phone was shown the "bigger screen" page, or went through it with "Try anyway". */
  z.object({ name: z.literal('phone_gate'), action: z.enum(['shown', 'bypassed']) }),
  /** A player joined a room, from this kind of device. */
  z.object({ name: z.literal('room_joined'), device: DeviceKind }),
]);
export type ClientEvent = z.infer<typeof ClientEvent>;

export const ClientEventResponse = z.object({ received: z.literal(true) });
