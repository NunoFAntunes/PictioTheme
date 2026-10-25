import type { PreparedCard, Rng } from '@pictiotheme/game-core';
import type { AvatarId, Card, PlayerId, Stroke } from '@pictiotheme/protocol';
import type {
  ActiveSpell,
  Curse,
  MatchResults,
  PieceShape,
  SkyStar,
  Spell,
  Team,
  TowerClientMessage,
  TowerServerMessage,
  TowerSettings,
} from '@pictiotheme/protocol/tower';

/**
 * Doodle Tower's authoritative room state machine: `step(state, event, ctx) → effects`, the same
 * functional-core pattern as game-core (docs/technical/backend-guidelines.md#realtime-rules).
 * Rules: docs/tower/product/game-rules.md. Physics runs elsewhere: this machine asks for it with
 * `physics` effects and hears back through `released`, `fumbled` and `height` events.
 */

export const TIMINGS = {
  /** The decider's Keep-or-Curse choice. Then it's Keep. */
  decideMs: 5_000,
  /** Time to place a piece. Then it drops where it is. */
  placeMs: 15_000,
  /** Steal guesses are off for this long after a wrong one. */
  /** Extra daze for each further fumble during a daze, and the most a daze can last. */
  dazeExtraMs: 2_000,
  dazeMaxMs: 10_000,
  /** Above the line this long to top out. */
  toppingMs: 3_000,
  /** The match's safety valve: then the taller tower wins. */
  matchMs: 15 * 60_000,
  /** A disconnected player is removed after this (outside a match: right away). */
  playerGraceMs: 120_000,
  /** Host rights pass on after the host is gone this long. */
  hostGraceMs: 30_000,
  /** A room nobody is in closes after this. */
  emptyMs: 5 * 60_000,
  /** A room sitting in the waiting room or the results closes after this. */
  idleMs: 30 * 60_000,
} as const;

/** How far above the tower a new piece appears (docs/tower/technical/physics.md). */
export const SPAWN_GAP = 6;

/** Drawing points per round, against bandwidth abuse (as in DoodleWhirl). */
export const MAX_POINTS_PER_ROUND = 100_000;

export type Stats = {
  drawings: number;
  solves: number;
  steals: number;
  /** Pieces this player cursed and sent. */
  curses: number;
  placements: number;
  fumbles: number;
  /** The quickest correct guess, from the start of the drawing (ms). */
  fastestSolveMs: number | null;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  connected: boolean;
  joinedAt: number;
  team: Team | null;
  stats: Stats;
  /** Test mode's stand-ins (bots.ts): a drawer bot draws, a builder bot places and acts. */
  bot?: 'drawer' | 'builder';
};

export type Round = {
  id: number;
  drawerId: PlayerId;
  card: Card;
  prepared: PreparedCard;
  startedAt: number;
  endsAt: number;
  /**
   * The crew sees the letter mask from the first hint on (the drawer gets a head start), with
   * these letters revealed; and when the next hint shows (null: none left).
   */
  maskShown: boolean;
  revealed: Set<number>;
  /** Solving it also gives the solver's crew a spell. */
  golden: boolean;
  /** Strokes begun under a Shaky hand spell: their points wobble (`shakePoints`). */
  shaky: Set<string>;
  nextHintAt: number | null;
  strokes: Stroke[];
  redo: Stroke[];
  points: number;
};

export type Placement = { pieceId: number; placerId: PlayerId; endsAt: number };

export type Crew = {
  team: Team;
  round: Round | null;
  /** The drawer rotation goes round the crew in join order, starting after this player. */
  lastDrawerId: PlayerId | null;
  /** Pieces waiting for this crew's tower, first first, with who should place each if free. */
  queue: { pieceId: number; placer: PlayerId | null }[];
  placing: Placement | null;
  daze: { since: number; until: number } | null;
  height: number;
  /** The height last sent to players, so tiny wobbles don't flood them. */
  sentHeight: number;
  toppingSince: number | null;
  /** Spells held, oldest first (at most `SPELL_TUNING.maxCharges`). */
  charges: Spell[];
  /** A spell on this crew's tower, cast by the other crew. */
  spell: ActiveSpell | null;
  /** The last round was golden: the next one can't be. */
  lastGolden: boolean;
  /** Since when this tower has been `comebackGap` behind the other (null: it isn't). */
  behindSince: number | null;
  /** When this crew last got a comeback charge. */
  comebackAt: number | null;
  /** The sky star by this crew's tower. */
  star: SkyStar | null;
};

export type PieceState = {
  id: number;
  word: string;
  team: Team;
  drawnBy: PlayerId;
  solvedBy: PlayerId;
  /** Who chooses Keep or Curse, and places it if kept: the drawer, or the thief. */
  deciderId: PlayerId;
  stolen: boolean;
  tower: Team | null;
  /** Cursed and sent to the other crew. */
  sent: boolean;
  /** Rolled when it's made; they only take effect once it's sent (`activeCurses`). */
  curses: Curse[];
  fumbled: boolean;
  shape: PieceShape;
  strokes: Stroke[];
  /** While the decider chooses: when it defaults to Keep. */
  decideBy: number | null;
  /** Who placed it (or was placing it), for the fumble count. */
  placedBy: PlayerId | null;
};

export type Match = {
  startedAt: number;
  endsAt: number;
  crews: Record<Team, Crew>;
  pieces: Map<number, PieceState>;
  nextPieceId: number;
  nextRoundId: number;
  /** Sky star turns so far: even ones are over the platform, odd ones past its edge. */
  starTurns: number;
  /** The shuffled cards still to deal, and the ones dealt. */
  pool: Card[];
  used: Card[];
};

export type TowerRoomState = {
  code: string;
  createdAt: number;
  hostId: PlayerId;
  settings: TowerSettings;
  /** Insertion order is join order: it drives the drawer rotation. */
  players: Map<PlayerId, PlayerState>;
  phase: 'waiting' | 'playing' | 'results';
  /** The easy cards of the allowed decks (Tower Mix), once the shell has loaded them. */
  words: Card[] | null;
  match: Match | null;
  results: MatchResults | null;
};

export type TimerId =
  | `round:${Team}`
  | `hint:${Team}`
  | `place:${Team}`
  | `daze:${Team}`
  | `topping:${Team}`
  /** The spell on this crew's tower: its warning ends, or it does. */
  | `spell:${Team}`
  /** The star by this crew's tower is caught, or gone. */
  | `star:${Team}`
  /** Time for new sky stars. */
  | 'stars'
  | `decide:${number}`
  | `grace:${PlayerId}`
  | 'host-grace'
  | 'match'
  | 'idle'
  | 'empty';

export type JoiningPlayer = { id: PlayerId; name: string; avatar: AvatarId };

export type TowerEvent =
  | { type: 'init' }
  | { type: 'join'; player: JoiningPlayer }
  | { type: 'disconnect'; playerId: PlayerId }
  /** A player in the room changed their name or drawing (the account widget). */
  | { type: 'identity'; playerId: PlayerId; name: string; avatar: AvatarId }
  | { type: 'message'; playerId: PlayerId; msg: TowerClientMessage }
  | { type: 'timer'; timer: TimerId }
  | { type: 'wordsLoaded'; cards: Card[] }
  // From the physics (one world per tower):
  /** The piece being placed was let go: it touched something, or it was dropped. */
  | { type: 'released'; tower: Team; pieceId: number }
  | { type: 'fumbled'; tower: Team; pieceIds: number[] }
  /** The last pigeon left: new pieces scared them away, or they fell. */
  | { type: 'pigeonGone'; tower: Team }
  /** A magpie lifted the tower's topmost piece out of it (null: there was nothing to take). */
  | { type: 'magpieTook'; tower: Team; pieceId: number | null }
  /**
   * The tower's measured height, about ten times a second, and whether a settled piece of it is
   * touching its sky star.
   */
  | { type: 'height'; tower: Team; height: number; starHeld?: boolean };

export type PhysicsOp =
  | { op: 'reset'; line: number }
  | {
      op: 'spawn';
      pieceId: number;
      outline: number[];
      parts: number[][];
      gap: number;
      /** A cursed piece's material (tower-physics `PieceMaterial`). */
      friction?: number;
      restitution?: number;
      bouncyMs?: number;
    }
  | { op: 'steer'; x?: number; angle?: number; fast?: boolean }
  | { op: 'drop' }
  /** Puts the tower's sky star there (a sensor), or takes it away. */
  | { op: 'star'; x: number; y: number; radius: number }
  | { op: 'unstar' }
  /**
   * The Pigeon spell: a pigeon for each of `sides` (−1 left, 1 right), each on the outer edge of
   * a different piece, the top ones first.
   */
  | { op: 'pigeon'; sides: (1 | -1)[] }
  | { op: 'unpigeon' }
  /** The Magpie spell takes the tower's topmost piece; answered with `magpieTook`. */
  | { op: 'magpie' }
  | { op: 'stop' };

export type MatchEndReason = MatchResults['reason'];

export type Effect =
  /** Send one message to these players. The shell serializes it once. */
  | { kind: 'send'; to: PlayerId[]; msg: TowerServerMessage }
  | { kind: 'schedule'; timer: TimerId; at: number }
  | { kind: 'cancel'; timer: TimerId }
  /** Load the words (Tower Mix); answer with `wordsLoaded`. */
  | { kind: 'loadWords' }
  | { kind: 'physics'; tower: Team; physics: PhysicsOp }
  /** The match is over: the shell records it (best-effort). */
  | { kind: 'matchEnded'; results: MatchResults; startedAt: number; endedAt: number }
  | { kind: 'close' };

export type StepContext = { now: number; rng: Rng };

export type Ctx = StepContext & { state: TowerRoomState; fx: Effect[] };

export const otherTeam = (team: Team): Team => (team === 'orange' ? 'teal' : 'orange');

export const emptyStats = (): Stats => ({
  drawings: 0,
  solves: 0,
  steals: 0,
  curses: 0,
  placements: 0,
  fumbles: 0,
  fastestSolveMs: null,
});
