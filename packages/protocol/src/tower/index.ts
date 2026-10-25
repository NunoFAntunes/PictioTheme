import { z } from 'zod';
import { DrawBegin, DrawFill, Points, Stroke, StrokeId } from '../drawing';
import { ErrorCode } from '../errors';
import { PlayerIdentity } from '../http';
import { GUESS_MAX_LENGTH, AvatarId, PlayerId, RoomCode } from '../room';

export { SHAKE_AMPLITUDE, shakePoints } from './shake';

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
  /**
   * Curses and spells (docs/tower/planning/power-ups.md). Off: Curse sends the piece as it is,
   * like the old Send.
   */
  powers: z.boolean(),
  /** Public rooms can be joined by Quick game; private ones only with the code or the link. */
  isPublic: z.boolean(),
  /**
   * A room for trying out the powers alone (docs/tower/planning/test-mode.md): bots fill the
   * crews and draw rectangles, and `test` messages stand in for guessing. Set when the room is
   * made (development only), never changed after. Missing: off.
   */
  testMode: z.boolean().optional(),
});
export type TowerSettings = z.infer<typeof TowerSettings>;

export const DEFAULT_TOWER_SETTINGS: TowerSettings = {
  roundSeconds: 60,
  line: 'medium',
  dazeSeconds: 5,
  steals: true,
  powers: true,
  isPublic: false,
};

// ── HTTP (`/api/tower/rooms`) ─────────────────────────────────────────────────

/** "Create a lobby" makes a private room; Quick game makes a public one when none has space. */
export const CreateTowerRoomRequest = PlayerIdentity.extend({
  isPublic: z.boolean().optional(),
  /** A private test-mode room. Refused unless the server allows it (never in production). */
  testMode: z.boolean().optional(),
});
export type CreateTowerRoomRequest = z.infer<typeof CreateTowerRoomRequest>;

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
  /** A melted piece (doodle-shape `Melt`): how its doodle droops, in logical px. */
  melt: z.object({ cx: z.number(), halfWidth: z.number(), sag: z.number() }).optional(),
});
export type PieceShape = z.infer<typeof PieceShape>;

/**
 * Keep the piece for your tower, or curse it and send it to the other crew's
 * (docs/tower/planning/power-ups.md).
 */
export const PieceChoice = z.enum(['keep', 'curse']);
export type PieceChoice = z.infer<typeof PieceChoice>;

/**
 * What a cursed piece does to the crew that has to place it: `slippery` (almost no friction),
 * `big_ice` (bigger, and slippery),
 * `melt` (it droops in the middle and its corners round off), `bouncy` (it bounces for a moment
 * after it lands), `blob` (bigger, and melted).
 */
export const Curse = z.enum(['slippery', 'big_ice', 'melt', 'bouncy', 'blob']);
export type Curse = z.infer<typeof Curse>;
export const CURSES = Curse.options;

/** What the curses do (docs/tower/planning/power-ups.md): the server and the sandbox use these. */
export const CURSE_TUNING = {
  /** `slippery` and `big_ice`: the lower friction of a contact counts, so it slides on anything. */
  friction: 0.05,
  /** `big_ice`: this many times the area. Never alone: a bigger piece also makes a taller tower. */
  bloat: 1.4,
  /** `bouncy`: this bouncy (the most bouncy of a contact counts), for this long after release. */
  restitution: 0.6,
  bouncyMs: 3_000,
} as const;

/**
 * Curses that do the same kind of thing can't come together (a golden piece gets two): one
 * change of shape, one of friction.
 */
const CURSE_KINDS: Record<Curse, readonly string[]> = {
  slippery: ['friction'],
  big_ice: ['shape', 'friction'],
  melt: ['shape'],
  bouncy: ['bounce'],
  blob: ['shape'],
};

export const cursesClash = (a: Curse, b: Curse) =>
  a === b || CURSE_KINDS[a].some((kind) => CURSE_KINDS[b].includes(kind));

/**
 * Spells (docs/tower/planning/power-ups.md): a crew holds up to `SPELL_TUNING.maxCharges` and
 * casts them at the other crew's tower. `fog` hides the top of their tower; `magpie` flies off
 * with the topmost piece of their tower, into your queue; `shaky` makes their drawer's strokes
 * wobble; `pigeon` lands three pigeons on the edges of their top pieces, small weights that tip
 * them.
 */
export const Spell = z.enum(['fog', 'magpie', 'shaky', 'pigeon']);
export type Spell = z.infer<typeof Spell>;
export const SPELLS = Spell.options;

export const SPELL_TUNING = {
  maxCharges: 2,
  /** A cast is shown over the target tower this long before it starts. */
  warnMs: 2_000,
  fogMs: 10_000,
  /** Strokes their drawer starts in this time wobble (`shakePoints`). */
  shakyMs: 10_000,
  /** The pigeons leave after this, if new pieces haven't scared them all away first. */
  pigeonMs: 25_000,
  /** How many pigeons land, each on a different piece. */
  pigeons: 3,
  /**
   * The magpie flies in during the warning and takes the top piece as the spell starts; it's
   * over once it has (this is only how long it's given to).
   */
  magpieMs: 5_000,
  /** About one round in this many deals a golden word (never twice in a row for a crew). */
  goldenEvery: 6,
  /** A comeback charge: when a piece falls off, or this far behind for `behindMs`. */
  comebackGap: 2,
  behindMs: 20_000,
  /** At most one comeback charge per crew this often. */
  comebackCooldownMs: 90_000,
} as const;

/**
 * Sky stars: one floats above each tower's top, at the same place relative to each tower's top,
 * so never inside the tower. They take turns: one over the platform (6 wide), then one just past
 * its edge. A settled piece of the tower that touches it for `holdMs` catches it: a spell.
 */
export const STAR_TUNING = {
  firstMs: 30_000,
  everyMs: 45_000,
  /** It's gone if nobody catches it in this time (under `everyMs`, so no turn is skipped). */
  lifeMs: 35_000,
  holdMs: 3_000,
  radius: 0.35,
  /** How far from the platform's centre (either side): over the platform, or past its edge. */
  insideX: [0.5, 2.4] as const,
  outsideX: [3.4, 4] as const,
  /** How far above the tower's top. */
  y: [1, 3] as const,
} as const;

/** A star by a crew's tower. `holdUntil`: a piece is touching it, and catches it then. */
export const SkyStar = z.object({
  x: z.number(),
  y: z.number(),
  expiresAt: z.number(),
  holdUntil: z.number().nullable(),
});
export type SkyStar = z.infer<typeof SkyStar>;

/** A spell on a crew's tower, cast by the other crew. It starts after the warning. */
/** Why a crew got a spell. */
export const SpellReason = z.enum(['golden', 'comeback', 'star']);
export type SpellReason = z.infer<typeof SpellReason>;

export const ActiveSpell = z.object({
  spell: Spell,
  casterId: PlayerId,
  startsAt: z.number(),
  /** When it ends: fog's time runs out, or the pigeons leave. */
  endsAt: z.number(),
});
export type ActiveSpell = z.infer<typeof ActiveSpell>;

/**
 * What a set of curses does to a piece: its friction and bounce (tower-physics `PieceMaterial`),
 * whether it grows and whether it melts.
 */
export function curseEffects(curses: readonly Curse[]) {
  const slippery = curses.includes('slippery') || curses.includes('big_ice');
  const bouncy = curses.includes('bouncy');
  return {
    material: {
      ...(slippery && { friction: CURSE_TUNING.friction }),
      ...(bouncy && {
        restitution: CURSE_TUNING.restitution,
        bouncyMs: CURSE_TUNING.bouncyMs,
      }),
    },
    bloat: curses.includes('big_ice') || curses.includes('blob') ? CURSE_TUNING.bloat : null,
    melt: curses.includes('melt') || curses.includes('blob'),
  };
}

export const TowerPiece = z.object({
  id: z.number().int(),
  word: z.string(),
  /** The crew whose drawing it was. */
  team: Team,
  drawnBy: PlayerId,
  solvedBy: PlayerId,
  stolen: z.boolean(),
  /** Who chooses Keep or Curse: its drawer, or the thief for a stolen piece. */
  deciderId: PlayerId,
  /** Where it's going, once the decider has chosen. Null while they decide. */
  tower: Team.nullable(),
  /** Cursed and sent to the other crew. */
  sent: z.boolean(),
  /**
   * Rolled when the piece is made, so the decider sees what Curse would do: they only take effect
   * once it's sent. Empty with powers off.
   */
  curses: z.array(Curse),
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
  /** A golden word: whoever solves it gets a spell for their crew as well as the piece. */
  golden: z.boolean(),
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
  /** The spells this crew holds, oldest first: everyone sees them. */
  charges: z.array(Spell),
  /** A spell on this crew's tower, cast by the other crew. */
  spell: ActiveSpell.nullable(),
  star: SkyStar.nullable(),
});
export type CrewView = z.infer<typeof CrewView>;

export const Deciding = z.object({
  pieceId: z.number().int(),
  /** The drawer (they place it if they keep it), or the thief for a stolen piece. */
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
  curses: z.number().int(),
  placements: z.number().int(),
  fumbles: z.number().int(),
});
export type PlayerStats = z.infer<typeof PlayerStats>;

export const TowerAward = z.object({
  kind: z.enum(['best_thief', 'meanest_curser', 'master_builder', 'quickest_guesser']),
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

/**
 * Test mode's stand-ins (docs/tower/planning/test-mode.md), refused in any other room. "The
 * rival" is the other crew's builder bot. `curse` replaces the rolled curses of the piece made.
 */
export const TestAction = z.discriminatedUnion('kind', [
  /** You guess your crew's drawing (`own`) or steal the other crew's, and decide Keep or Curse. */
  z.object({ kind: z.literal('solve'), target: z.enum(['own', 'steal']), curse: Curse.optional() }),
  /** The rival guesses its crew's drawing (`own`) or steals yours, and chooses at once. */
  z.object({
    kind: z.literal('rival'),
    target: z.enum(['own', 'steal']),
    choice: PieceChoice,
    curse: Curse.optional(),
  }),
  /** The rival casts the spell in this slot at your tower. */
  z.object({ kind: z.literal('rival-cast'), slot: z.number().int().min(0).max(1) }),
  /** Gives a crew this spell (if it has room). */
  z.object({ kind: z.literal('grant'), team: Team, spell: Spell }),
  /** Makes a crew's current drawing golden. */
  z.object({ kind: z.literal('golden'), team: Team }),
  /** Sky stars now, instead of in a minute or so. */
  z.object({ kind: z.literal('stars') }),
]);
export type TestAction = z.infer<typeof TestAction>;

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
  /** Casts the crew's spell in this slot at the other crew. Anyone in the crew but the drawer. */
  z.object({ t: z.literal('spell:cast'), slot: z.number().int().min(0).max(1) }),
  z.object({ t: z.literal('test'), action: TestAction }),
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
    /** The piece's new shape, when a curse changed it (`big_ice`). */
    shape: PieceShape.optional(),
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
  /** A crew's spells changed. `gained` says why when one was added. */
  z.object({
    t: z.literal('crew:charges'),
    team: Team,
    charges: z.array(Spell),
    gained: z.object({ spell: Spell, reason: SpellReason }).optional(),
  }),
  /** The star by a crew's tower appeared, is being held, or is gone (`caught` if it was caught). */
  z.object({
    t: z.literal('crew:star'),
    team: Team,
    star: SkyStar.nullable(),
    caught: z.boolean().optional(),
  }),
  /** A spell was cast at this crew's tower (null: it's over). */
  z.object({ t: z.literal('crew:spell'), team: Team, spell: ActiveSpell.nullable() }),
  /**
   * A magpie took the topmost piece off one crew's tower into the other's queue, for its caster
   * to place.
   */
  z.object({
    t: z.literal('piece:magpied'),
    pieceId: z.number().int(),
    from: Team,
    to: Team,
    casterId: PlayerId,
  }),
  z.object({ t: z.literal('match:end'), results: MatchResults }),
  z.object({ t: z.literal('error'), code: ErrorCode, message: z.string() }),
  z.object({ t: z.literal('pong'), ts: z.number(), serverTime: z.number() }),
  z.object({ t: z.literal('server:restarting') }),
]);
export type TowerServerMessage = z.infer<typeof TowerServerMessage>;

/** Body values in a `tower:frame` per body. */
export const FRAME_STRIDE = 4;
