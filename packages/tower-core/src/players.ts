import { shuffle } from '@pictiotheme/game-core';
import type { PlayerId } from '@pictiotheme/protocol';
import { TEAMS, TOWER_MAX_PER_CREW, TowerSettings, type Team } from '@pictiotheme/protocol/tower';
import { connectedHumans, removeBots } from './bots';
import {
  finishMatch,
  onDeciderLeft,
  onDrawerLeft,
  onPlacerLeft,
  resumeIdleCrews,
  tryStartPlacement,
} from './match';
import {
  broadcastPlayers,
  cancel,
  connectedIds,
  schedule,
  send,
  sendError,
  sendToAll,
} from './output';
import { emptyStats, TIMINGS, type Ctx, type JoiningPlayer } from './types';
import { snapshotFor } from './views';

/** Joining, leaving, crews, host rights and the waiting room's settings. */

function crewSize(c: Ctx, team: Team): number {
  let n = 0;
  for (const p of c.state.players.values()) if (p.team === team) n++;
  return n;
}

/** The smaller crew (orange on a tie), for newcomers. */
function smallerCrew(c: Ctx): Team {
  return crewSize(c, 'teal') < crewSize(c, 'orange') ? 'teal' : 'orange';
}

export function onJoin(c: Ctx, joining: JoiningPlayer): void {
  const { state } = c;
  const existing = state.players.get(joining.id);
  if (existing) {
    existing.connected = true;
    existing.name = joining.name;
    existing.avatar = joining.avatar;
    cancel(c, `grace:${joining.id}`);
    if (joining.id === state.hostId) cancel(c, 'host-grace');
  } else {
    state.players.set(joining.id, {
      ...joining,
      connected: true,
      joinedAt: c.now,
      team: smallerCrew(c),
      stats: emptyStats(),
    });
  }
  cancel(c, 'empty');
  send(c, joining.id, snapshotFor(state, joining.id, c.now));
  broadcastPlayers(c);
  if (state.phase === 'playing') {
    // A newcomer can be the crew's free placer, or its drawer.
    const team = state.players.get(joining.id)?.team;
    if (team) tryStartPlacement(c, team);
    resumeIdleCrews(c);
  }
}

export function onDisconnect(c: Ctx, playerId: PlayerId): void {
  const { state } = c;
  const player = state.players.get(playerId);
  if (!player?.connected) return;
  player.connected = false;
  schedule(c, `grace:${playerId}`, c.now + TIMINGS.playerGraceMs);
  if (playerId === state.hostId) schedule(c, 'host-grace', c.now + TIMINGS.hostGraceMs);
  if (state.phase === 'playing') {
    onDrawerLeft(c, playerId);
    onPlacerLeft(c, playerId);
    onDeciderLeft(c, playerId);
  }
  if (connectedHumans(c).length === 0) schedule(c, 'empty', c.now + TIMINGS.emptyMs);
  broadcastPlayers(c);
}

/** Gone for good: out of the room (and its crew). */
export function onGraceTimer(c: Ctx, playerId: PlayerId): void {
  const player = c.state.players.get(playerId);
  if (!player || player.connected) return;
  c.state.players.delete(playerId);
  broadcastPlayers(c);
}

export function onHostGraceTimer(c: Ctx): void {
  const { state } = c;
  if (state.players.get(state.hostId)?.connected) return;
  const next = connectedHumans(c)[0];
  if (!next) return;
  state.hostId = next.id;
  broadcastPlayers(c);
}

export function onEmptyTimer(c: Ctx): void {
  if (connectedHumans(c).length > 0) return;
  if (c.state.phase === 'playing') finishMatch(c, null, 'abandoned');
  c.fx.push({ kind: 'close' });
}

// ── The waiting room ─────────────────────────────────────────────────────────

function assertWaiting(c: Ctx, playerId: PlayerId): boolean {
  if (c.state.phase === 'waiting') return true;
  sendError(c, playerId, 'WRONG_PHASE', 'Crews and settings are set before the match');
  return false;
}

function assertHost(c: Ctx, playerId: PlayerId): boolean {
  if (c.state.hostId === playerId) return true;
  sendError(c, playerId, 'NOT_HOST', 'Only the host can do that');
  return false;
}

function moveToCrew(c: Ctx, by: PlayerId, playerId: PlayerId, team: Team): void {
  const player = c.state.players.get(playerId);
  if (!player || player.team === team) return;
  if (crewSize(c, team) >= TOWER_MAX_PER_CREW) {
    sendError(c, by, 'ROOM_FULL', 'That crew is full');
    return;
  }
  player.team = team;
  broadcastPlayers(c);
}

export function onCrewJoin(c: Ctx, playerId: PlayerId, team: Team): void {
  if (assertWaiting(c, playerId)) moveToCrew(c, playerId, playerId, team);
}

export function onCrewMove(c: Ctx, by: PlayerId, playerId: PlayerId, team: Team): void {
  if (assertWaiting(c, by) && assertHost(c, by)) moveToCrew(c, by, playerId, team);
}

/** Deals everyone into the two crews at random, alternating, so they differ by one at most. */
export function onCrewShuffle(c: Ctx, by: PlayerId): void {
  if (!assertWaiting(c, by) || !assertHost(c, by)) return;
  const players = shuffle([...c.state.players.values()], c.rng);
  players.forEach((p, i) => {
    p.team = TEAMS[i % 2] ?? 'orange';
  });
  broadcastPlayers(c);
}

export function onSettings(c: Ctx, by: PlayerId, patch: Partial<TowerSettings>): void {
  if (!assertWaiting(c, by) || !assertHost(c, by)) return;
  // Test mode is set when the room is made (never by a message), and a test room stays private.
  const { testMode } = c.state.settings;
  const locked = testMode ? { testMode, isPublic: false } : { testMode };
  const next = TowerSettings.safeParse({ ...c.state.settings, ...patch, ...locked });
  if (!next.success) {
    sendError(c, by, 'VALIDATION', 'Invalid settings');
    return;
  }
  c.state.settings = next.data;
  sendToAll(c, { t: 'room:settings', settings: next.data });
}

/** Back from the results to the waiting room, with the same crews. */
export function onRematch(c: Ctx, by: PlayerId): void {
  const { state } = c;
  if (state.phase !== 'results') {
    sendError(c, by, 'WRONG_PHASE', 'There is no match to replay');
    return;
  }
  if (!assertHost(c, by)) return;
  state.phase = 'waiting';
  state.match = null;
  state.results = null;
  removeBots(c);
  broadcastPlayers(c);
  for (const id of connectedIds(c)) send(c, id, snapshotFor(state, id, c.now));
}
