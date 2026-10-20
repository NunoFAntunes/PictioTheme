import { z } from 'zod';
import { DrawBegin, DrawFill, Points, Stroke, StrokeId } from '../drawing';
import { ErrorCode } from '../errors';
import { GUESS_MAX_LENGTH, AvatarId, PlayerId, RoomCode } from '../room';

/**
 * Doodle Tower's wire format (docs/tower/technical/realtime-protocol.md), on its own WebSocket
 * endpoint (`/ws/tower`). Envelope: `{ t: '<type>', ...payload }`, like DoodleWhirl's. Strokes,
 * identities and error codes are DoodleWhirl's own schemas.
 */

// ── Basics ───────────────────────────────────────────────────────────────────

export const Team = z.enum(['orange', 'teal']);
export type Team = z.infer<typeof Team>;
export const TEAMS = ['orange', 'teal'] as const satisfies readonly Team[];

/** Height lines in metres (docs/tower/technical/physics.md#tuning-values-to-find-in-the-sandbox). */
export const LINE_HEIGHTS = { short: 6, medium: 10, tall: 15 } as const;
export const LineHeight = z.enum(['short', 'medium', 'tall']);
export type LineHeight = z.infer<typeof LineHeight>;

export const TowerSettings = z.object({
  /** How long a drawer has before the drawing expires. */
  roundSeconds: z.number().int().min(30).max(120),
  line: LineHeight,
  /** The fumble daze, in seconds (0: off). */
  dazeSeconds: z.number().int().min(0).max(10),
  steals: z.boolean(),
});
export type TowerSettings = z.infer<typeof TowerSettings>;

export const DEFAULT_TOWER_SETTINGS: TowerSettings = {
  roundSeconds: 60,
  line: 'medium',
  dazeSeconds: 5,
  steals: true,
};

export const TOWER_MIN_PER_CREW = 2;
export const TOWER_MAX_PER_CREW = 6;

export const TowerPlayer = z.object({
  id: PlayerId,
  name: z.string(),
  avatar: AvatarId,
  connected: z.boolean(),
  /** Null only for a moment, before the room puts a newcomer in a crew. */
  team: Team.nullable(),
});
export type TowerPlayer = z.infer<typeof TowerPlayer>;

/** Flat `[x0, y0, x1, y1, …]`. */
const FlatPolygon = z.array(z.number());

/** A piece's geometry and how to draw it (packages/doodle-shape `Piece`, plus its silhouette). */
export const PieceShape = z.object({
  outline: FlatPolygon,
  parts: z.array(FlatPolygon),
  area: z.number(),
  scale: z.number(),
  origin: z.object({ x: z.number(), y: z.number() }),
  bounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  limitedBy: z.enum(['area', 'length', 'thickness']),
  /** The silhouette in logical canvas px, and the grid's cell size, for the doodle's bitmap. */
  silhouette: FlatPolygon,
  cell: z.number(),
});
export type PieceShape = z.infer<typeof PieceShape>;

export const PieceChoice = z.enum(['build', 'send']);
export type PieceChoice = z.infer<typeof PieceChoice>;

export const TowerPiece = z.object({
  id: z.number().int(),
  word: z.string(),
  /** The crew whose drawing it was. */
  team: Team,
  drawnBy: PlayerId,
  solvedBy: PlayerId,
  stolen: z.boolean(),
  /** Who chooses Build or Send: its drawer, or the thief for a stolen piece. */
  deciderId: PlayerId,
  /** Where it's going, once the decider has chosen. Null while they decide. */
  tower: Team.nullable(),
  sent: z.boolean(),
  fumbled: z.boolean(),
  shape: PieceShape,
  /** The drawing, so every client can draw the piece (from the last clear on). */
  strokes: z.array(Stroke),
});
export type TowerPiece = z.infer<typeof TowerPiece>;

/** A crew's current drawing, as one player sees it. */
export const RoundView = z.object({
  id: z.number().int(),
  drawerId: PlayerId,
  startedAt: z.number(),
  endsAt: z.number(),
  /** Only for the drawer. */
  word: z.string().optional(),
  /** Only for the drawer's crew, once the first hint is due: the letter mask with its hints. */
  mask: z.string().optional(),
  strokes: z.array(Stroke),
});
export type RoundView = z.infer<typeof RoundView>;

export const Placing = z.object({
  pieceId: z.number().int(),
  placerId: PlayerId,
  endsAt: z.number(),
});
export type Placing = z.infer<typeof Placing>;

export const CrewView = z.object({
  round: RoundView.nullable(),
  /** Pieces waiting to be placed on this crew's tower, first first. */
  queue: z.array(z.number().int()),
  placing: Placing.nullable(),
  dazedUntil: z.number().nullable(),
  height: z.number(),
  /** Set while the tower is above the line: when it tops out if it stays there. */
  toppingUntil: z.number().nullable(),
});
export type CrewView = z.infer<typeof CrewView>;

export const Deciding = z.object({
  pieceId: z.number().int(),
  /** The drawer (they place it if they build), or the thief for a stolen piece. */
  deciderId: PlayerId,
  endsAt: z.number(),
});
export type Deciding = z.infer<typeof Deciding>;

export const TowerPhase = z.enum(['waiting', 'playing', 'results']);
export type TowerPhase = z.infer<typeof TowerPhase>;

export const PlayerStats = z.object({
  id: PlayerId,
  name: z.string(),
  team: Team,
  drawings: z.number().int(),
  solves: z.number().int(),
  steals: z.number().int(),
  sends: z.number().int(),
  placements: z.number().int(),
  fumbles: z.number().int(),
});
export type PlayerStats = z.infer<typeof PlayerStats>;

export const TowerAward = z.object({
  kind: z.enum(['best_thief', 'meanest_sender', 'master_builder', 'quickest_guesser']),
  playerId: PlayerId,
});
export type TowerAward = z.infer<typeof TowerAward>;

export const MatchResults = z.object({
  /** Null: a draw (the time ran out with both towers the same height). */
  winner: Team.nullable(),
  reason: z.enum(['topped_out', 'time', 'abandoned']),
  heights: z.object({ orange: z.number(), teal: z.number() }),
  players: z.array(PlayerStats),
  awards: z.array(TowerAward),
});
export type MatchResults = z.infer<typeof MatchResults>;

// ── Client → Server ──────────────────────────────────────────────────────────

/** Where the placer steers the piece (world units, radians), and whether ↓ is held. */
export const PlaceSteer = z.object({
  x: z.number().min(-50).max(50).optional(),
  angle: z.number().min(-100).max(100).optional(),
  fast: z.boolean().optional(),
});

export const TowerClientMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('crew:join'), team: Team }),
  /** Host only, while waiting. */
  z.object({ t: z.literal('crew:move'), playerId: PlayerId, team: Team }),
  z.object({ t: z.literal('crew:shuffle') }),
  z.object({ t: z.literal('settings:update'), settings: TowerSettings.partial() }),
  z.object({ t: z.literal('match:start') }),
  /** Host only, at the results: back to the waiting room with the same crews. */
  z.object({ t: z.literal('match:rematch') }),
  // The drawer's strokes. Fills only colour in closed shapes: clients skip a fill that would
  // reach the canvas's edge.
  z.object({ t: z.literal('draw:begin'), ...DrawBegin.shape }),
  z.object({ t: z.literal('draw:pts'), id: StrokeId, pts: Points }),
  z.object({ t: z.literal('draw:end'), id: StrokeId }),
  z.object({ t: z.literal('draw:fill'), ...DrawFill.shape }),
  z.object({ t: z.literal('draw:undo') }),
  z.object({ t: z.literal('draw:redo') }),
  z.object({ t: z.literal('draw:clear') }),
  /**
   * A guess: checked against your crew's drawing first, then (steals on) the other crew's, where
   * a right answer steals it.
   */
  z.object({ t: z.literal('guess'), text: z.string().trim().min(1).max(GUESS_MAX_LENGTH) }),
  z.object({ t: z.literal('piece:decide'), pieceId: z.number().int(), choice: PieceChoice }),
  z.object({ t: z.literal('place:steer'), ...PlaceSteer.shape }),
  z.object({ t: z.literal('place:drop') }),
  z.object({ t: z.literal('ping'), ts: z.number() }),
]);
export type TowerClientMessage = z.infer<typeof TowerClientMessage>;

/** The drawing operations, as clients send them and the server forwards them (`crew:draw`). */
export const TowerDrawOp = z.discriminatedUnion('t', [
  z.object({ t: z.literal('draw:begin'), ...DrawBegin.shape }),
  z.object({ t: z.literal('draw:pts'), id: StrokeId, pts: Points }),
  z.object({ t: z.literal('draw:end'), id: StrokeId }),
  z.object({ t: z.literal('draw:fill'), ...DrawFill.shape }),
  z.object({ t: z.literal('draw:undo') }),
  z.object({ t: z.literal('draw:redo') }),
  z.object({ t: z.literal('draw:clear') }),
]);
export type TowerDrawOp = z.infer<typeof TowerDrawOp>;

// ── Server → Client ──────────────────────────────────────────────────────────

const Crews = z.object({ orange: CrewView, teal: CrewView });

export const TowerSnapshot = z.object({
  t: z.literal('room:snapshot'),
  you: PlayerId,
  code: RoomCode,
  hostId: PlayerId,
  settings: TowerSettings,
  phase: TowerPhase,
  players: z.array(TowerPlayer),
  crews: Crews,
  /** Every piece of this match: deciding, queued, being placed, in a tower or fumbled. */
  pieces: z.array(TowerPiece),
  deciding: z.array(Deciding),
  /** When the match's time limit runs out. */
  matchEndsAt: z.number().nullable(),
  results: MatchResults.nullable(),
  serverTime: z.number(),
});
export type TowerSnapshot = z.infer<typeof TowerSnapshot>;

export const RoundEndOutcome = z.enum(['solved', 'stolen', 'expired', 'blank', 'drawer_left']);
export type RoundEndOutcome = z.infer<typeof RoundEndOutcome>;

export const TowerServerMessage = z.discriminatedUnion('t', [
  TowerSnapshot,
  z.object({ t: z.literal('room:players'), players: z.array(TowerPlayer), hostId: PlayerId }),
  z.object({ t: z.literal('room:settings'), settings: TowerSettings }),
  z.object({ t: z.literal('round:start'), team: Team, round: RoundView }),
  z.object({ t: z.literal('round:hint'), team: Team, roundId: z.number().int(), mask: z.string() }),
  z.object({ t: z.literal('crew:draw'), team: Team, op: TowerDrawOp }),
  z.object({
    t: z.literal('guess:result'),
    target: z.enum(['own', 'steal']),
    text: z.string(),
    result: z.enum(['wrong', 'close', 'correct']),
  }),
  /** A teammate's guess (your crew only). `solved` replaces the text when it was right. */
  z.object({
    t: z.literal('crew:feed'),
    playerId: PlayerId,
    target: z.enum(['own', 'steal']),
    text: z.string().optional(),
    solved: z.boolean().optional(),
  }),
  z.object({
    t: z.literal('round:end'),
    team: Team,
    roundId: z.number().int(),
    outcome: RoundEndOutcome,
    word: z.string(),
    solverId: PlayerId.optional(),
    pieceId: z.number().int().optional(),
  }),
  z.object({ t: z.literal('piece:made'), piece: TowerPiece, deciding: Deciding }),
  z.object({
    t: z.literal('piece:queued'),
    pieceId: z.number().int(),
    tower: Team,
    sent: z.boolean(),
  }),
  z.object({ t: z.literal('place:start'), tower: Team, placing: Placing }),
  z.object({ t: z.literal('place:end'), tower: Team, pieceId: z.number().int() }),
  /**
   * The tower's moving bodies, 20 times a second: flat `[id, x, y, angle, …]` with x and y in
   * millimetres and the angle in milliradians (integers keep the JSON small).
   */
  z.object({
    t: z.literal('tower:frame'),
    tower: Team,
    tick: z.number().int(),
    bodies: z.array(z.number().int()),
  }),
  z.object({
    t: z.literal('tower:height'),
    tower: Team,
    height: z.number(),
    toppingUntil: z.number().nullable(),
  }),
  z.object({
    t: z.literal('tower:fumble'),
    tower: Team,
    pieceIds: z.array(z.number().int()),
    dazedUntil: z.number().nullable(),
  }),
  z.object({ t: z.literal('match:end'), results: MatchResults }),
  z.object({ t: z.literal('error'), code: ErrorCode, message: z.string() }),
  z.object({ t: z.literal('pong'), ts: z.number(), serverTime: z.number() }),
  z.object({ t: z.literal('server:restarting') }),
]);
export type TowerServerMessage = z.infer<typeof TowerServerMessage>;

/** Body values in a `tower:frame` per body. */
export const FRAME_STRIDE = 4;
