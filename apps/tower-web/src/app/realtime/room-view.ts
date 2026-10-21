import type { PlayerId } from '@pictiotheme/protocol';
import {
  TEAMS,
  type CrewView,
  type Curse,
  type Deciding,
  type Spell,
  type SpellReason,
  type MatchResults,
  type Team,
  type TowerPhase,
  type TowerPiece,
  type TowerPlayer,
  type TowerServerMessage,
  type TowerSettings,
  type TowerSnapshot,
} from '@pictiotheme/protocol/tower';

/**
 * The client's view of a room: a pure reducer over the server's messages (unit-tested). Strokes
 * and tower frames are kept outside it (rule W9): they arrive many times a second.
 */

export type FeedEntry = {
  key: number;
  playerId: PlayerId;
  target: 'own' | 'steal';
  /** A wrong guess's text; null when it was right. */
  text: string | null;
  /** Only on your own guesses: what the server said. */
  result?: 'wrong' | 'close' | 'correct';
};

/** Something worth a banner: a steal, a fumble, a solve. */
export type RoomEvent = {
  key: number;
  at: number;
  kind:
    | 'solved'
    | 'stolen'
    | 'expired'
    | 'blank'
    | 'fumble'
    | 'sent'
    /** `team` got `spell`, for `reason`. */
    | 'gained'
    /** `playerId` cast `spell` at `team`'s tower. */
    | 'cast'
    /** A magpie took `word` (`pieceId`) from `team` for `playerId`. */
    | 'magpied';
  team: Team;
  playerId?: PlayerId;
  pieceId?: number;
  word?: string;
  /** A cursed piece's curses. */
  curses?: Curse[];
  spell?: Spell;
  reason?: SpellReason;
};

export type RoomView = {
  you: PlayerId;
  code: string;
  hostId: PlayerId;
  settings: TowerSettings;
  phase: TowerPhase;
  players: TowerPlayer[];
  crews: Record<Team, CrewView>;
  pieces: Record<number, TowerPiece>;
  deciding: Deciding[];
  matchEndsAt: number | null;
  results: MatchResults | null;
  /** Your crew's guesses (and your own), newest last. */
  feed: FeedEntry[];
  events: RoomEvent[];
  /** The last error the server sent you. */
  error: { key: number; message: string } | null;
  restarting: boolean;
};

const FEED_LIMIT = 30;
const EVENTS_LIMIT = 10;
let seq = 0;
const nextKey = () => ++seq;

export function viewFromSnapshot(msg: TowerSnapshot, previous: RoomView | null): RoomView {
  return {
    you: msg.you,
    code: msg.code,
    hostId: msg.hostId,
    settings: msg.settings,
    phase: msg.phase,
    players: msg.players,
    crews: msg.crews,
    pieces: Object.fromEntries(msg.pieces.map((p) => [p.id, p])),
    deciding: msg.deciding,
    matchEndsAt: msg.matchEndsAt,
    results: msg.results,
    // A reconnect mid-match keeps what you'd already seen.
    feed: previous?.code === msg.code && msg.phase === 'playing' ? previous.feed : [],
    events: [],
    error: null,
    restarting: false,
  };
}

export function myTeam(view: RoomView): Team | null {
  return view.players.find((p) => p.id === view.you)?.team ?? null;
}

function withCrew(view: RoomView, team: Team, patch: Partial<CrewView>): RoomView {
  return { ...view, crews: { ...view.crews, [team]: { ...view.crews[team], ...patch } } };
}

function pushFeed(view: RoomView, entry: Omit<FeedEntry, 'key'>): RoomView {
  return { ...view, feed: [...view.feed, { key: nextKey(), ...entry }].slice(-FEED_LIMIT) };
}

function pushEvent(view: RoomView, event: Omit<RoomEvent, 'key'>): RoomView {
  return { ...view, events: [...view.events, { key: nextKey(), ...event }].slice(-EVENTS_LIMIT) };
}

/** Applies one message (not the snapshot, strokes or frames) to the view. */
export function applyServerMessage(view: RoomView, msg: TowerServerMessage, now: number): RoomView {
  switch (msg.t) {
    case 'room:players':
      return { ...view, players: msg.players, hostId: msg.hostId };
    case 'room:settings':
      return { ...view, settings: msg.settings };
    case 'round:start':
      return withCrew(view, msg.team, { round: msg.round });
    case 'round:hint': {
      const round = view.crews[msg.team].round;
      if (round?.id !== msg.roundId) return view;
      return withCrew(view, msg.team, { round: { ...round, mask: msg.mask } });
    }
    case 'round:end': {
      const round = view.crews[msg.team].round;
      const next = round?.id === msg.roundId ? withCrew(view, msg.team, { round: null }) : view;
      return pushEvent(next, {
        at: now,
        kind: msg.outcome === 'drawer_left' ? 'expired' : msg.outcome,
        team: msg.team,
        playerId: msg.solverId,
        word: msg.word,
      });
    }
    case 'crew:feed':
      return pushFeed(view, {
        playerId: msg.playerId,
        target: msg.target,
        text: msg.solved ? null : (msg.text ?? ''),
      });
    case 'guess:result':
      return pushFeed(view, {
        playerId: view.you,
        target: msg.target,
        text: msg.result === 'correct' ? null : msg.text,
        result: msg.result,
      });
    case 'piece:made':
      return {
        ...view,
        pieces: { ...view.pieces, [msg.piece.id]: msg.piece },
        deciding: [...view.deciding.filter((d) => d.pieceId !== msg.piece.id), msg.deciding],
      };
    case 'piece:queued': {
      const piece = view.pieces[msg.pieceId];
      const next: RoomView = {
        ...view,
        pieces: piece
          ? {
              ...view.pieces,
              [msg.pieceId]: {
                ...piece,
                tower: msg.tower,
                sent: msg.sent,
                ...(msg.shape && { shape: msg.shape }),
              },
            }
          : view.pieces,
        deciding: view.deciding.filter((d) => d.pieceId !== msg.pieceId),
      };
      const queued = withCrew(next, msg.tower, {
        queue: [...view.crews[msg.tower].queue, msg.pieceId],
      });
      return msg.sent && piece
        ? pushEvent(queued, {
            at: now,
            kind: 'sent',
            team: msg.tower,
            playerId: piece.deciderId,
            word: piece.word,
            curses: piece.curses,
          })
        : queued;
    }
    case 'place:start':
      return withCrew(view, msg.tower, {
        placing: msg.placing,
        queue: view.crews[msg.tower].queue.filter((id) => id !== msg.placing.pieceId),
      });
    case 'place:end': {
      const placing = view.crews[msg.tower].placing;
      return placing?.pieceId === msg.pieceId ? withCrew(view, msg.tower, { placing: null }) : view;
    }
    case 'tower:height':
      return withCrew(view, msg.tower, { height: msg.height, toppingUntil: msg.toppingUntil });
    case 'tower:fumble': {
      const pieces = { ...view.pieces };
      for (const id of msg.pieceIds) {
        const piece = pieces[id];
        if (piece) pieces[id] = { ...piece, fumbled: true };
      }
      const placing = view.crews[msg.tower].placing;
      const next = withCrew({ ...view, pieces }, msg.tower, {
        dazedUntil: msg.dazedUntil,
        ...(placing && msg.pieceIds.includes(placing.pieceId) && { placing: null }),
      });
      return pushEvent(next, { at: now, kind: 'fumble', team: msg.tower });
    }
    case 'crew:charges': {
      const next = withCrew(view, msg.team, { charges: msg.charges });
      return msg.gained
        ? pushEvent(next, { at: now, kind: 'gained', team: msg.team, ...msg.gained })
        : next;
    }
    case 'crew:spell': {
      const next = withCrew(view, msg.team, { spell: msg.spell });
      return msg.spell
        ? pushEvent(next, {
            at: now,
            kind: 'cast',
            team: msg.team,
            playerId: msg.spell.casterId,
            spell: msg.spell.spell,
          })
        : next;
    }
    case 'crew:star':
      return withCrew(view, msg.team, { star: msg.star });
    case 'piece:magpied': {
      const piece = view.pieces[msg.pieceId];
      let next = withCrew(view, msg.from, {
        queue: view.crews[msg.from].queue.filter((id) => id !== msg.pieceId),
      });
      next = withCrew(next, msg.to, { queue: [...next.crews[msg.to].queue, msg.pieceId] });
      if (piece)
        next = { ...next, pieces: { ...next.pieces, [msg.pieceId]: { ...piece, tower: msg.to } } };
      return pushEvent(next, {
        at: now,
        kind: 'magpied',
        team: msg.from,
        playerId: msg.casterId,
        pieceId: msg.pieceId,
        ...(piece && { word: piece.word }),
      });
    }
    case 'match:end':
      return {
        ...view,
        phase: 'results',
        results: msg.results,
        matchEndsAt: null,
        deciding: [],
        crews: Object.fromEntries(
          TEAMS.map((t) => [t, { ...view.crews[t], round: null, placing: null, spell: null }]),
        ) as Record<Team, CrewView>,
      };
    case 'error':
      return { ...view, error: { key: nextKey(), message: msg.message } };
    case 'server:restarting':
      return { ...view, restarting: true };
    case 'room:snapshot':
    case 'crew:draw':
    case 'tower:frame':
    case 'pong':
      return view;
  }
}
