import { buildMask } from '@pictiotheme/game-core';
import type { PlayerId } from '@pictiotheme/protocol';
import {
  TEAMS,
  type CrewView,
  type Deciding,
  type RoundView,
  type Team,
  type TowerPiece,
  type TowerPlayer,
  type TowerSnapshot,
} from '@pictiotheme/protocol/tower';
import { TIMINGS, type Crew, type PieceState, type Round, type TowerRoomState } from './types';

/**
 * What each player may see (rule R2): the word only to its drawer, the letter mask only to the
 * drawer's crew. Everything else about a crew's drawing (its strokes) is for everyone: stealing
 * means watching the other crew draw.
 */

export function publicPlayers(state: TowerRoomState): TowerPlayer[] {
  return [...state.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    connected: p.connected,
    team: p.team,
  }));
}

export function roundView(
  state: TowerRoomState,
  team: Team,
  round: Round,
  viewer: PlayerId,
): RoundView {
  const viewerTeam = state.players.get(viewer)?.team ?? null;
  return {
    id: round.id,
    drawerId: round.drawerId,
    startedAt: round.startedAt,
    endsAt: round.endsAt,
    ...(viewer === round.drawerId && { word: round.card.text }),
    ...(viewerTeam === team &&
      round.maskShown && { mask: buildMask(round.card.text, round.revealed) }),
    golden: round.golden,
    strokes: round.strokes,
  };
}

function crewView(state: TowerRoomState, crew: Crew, viewer: PlayerId): CrewView {
  return {
    round: crew.round ? roundView(state, crew.team, crew.round, viewer) : null,
    queue: crew.queue.map((q) => q.pieceId),
    placing: crew.placing,
    dazedUntil: crew.daze?.until ?? null,
    height: crew.height,
    toppingUntil: crew.toppingSince === null ? null : crew.toppingSince + TIMINGS.toppingMs,
    charges: crew.charges,
    spell: crew.spell,
    star: crew.star,
  };
}

const EMPTY_CREW: CrewView = {
  round: null,
  queue: [],
  placing: null,
  dazedUntil: null,
  height: 0,
  toppingUntil: null,
  charges: [],
  spell: null,
  star: null,
};

export function pieceView(piece: PieceState): TowerPiece {
  return {
    id: piece.id,
    word: piece.word,
    team: piece.team,
    drawnBy: piece.drawnBy,
    solvedBy: piece.solvedBy,
    deciderId: piece.deciderId,
    stolen: piece.stolen,
    tower: piece.tower,
    sent: piece.sent,
    curses: piece.curses,
    fumbled: piece.fumbled,
    shape: piece.shape,
    strokes: piece.strokes,
  };
}

export function decidingOf(piece: PieceState): Deciding | null {
  return piece.decideBy === null
    ? null
    : { pieceId: piece.id, deciderId: piece.deciderId, endsAt: piece.decideBy };
}

export function snapshotFor(state: TowerRoomState, viewer: PlayerId, now: number): TowerSnapshot {
  const { match } = state;
  const pieces = match ? [...match.pieces.values()] : [];
  const crews = Object.fromEntries(
    TEAMS.map((team) => [team, match ? crewView(state, match.crews[team], viewer) : EMPTY_CREW]),
  ) as Record<Team, CrewView>;
  return {
    t: 'room:snapshot',
    you: viewer,
    code: state.code,
    hostId: state.hostId,
    settings: state.settings,
    phase: state.phase,
    players: publicPlayers(state),
    crews,
    pieces: pieces.map(pieceView),
    deciding: pieces.map(decidingOf).filter((d) => d !== null),
    matchEndsAt: state.phase === 'playing' && match ? match.endsAt : null,
    results: state.results,
    serverTime: now,
  };
}
