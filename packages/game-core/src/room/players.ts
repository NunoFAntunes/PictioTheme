import type { PlayerId } from '@pictiotheme/protocol';
import { checkAllSolved, checkPlayerCount, currentDrawerId, endTurn } from './match';
import { broadcastPlayers, cancel, schedule, send, sendError, sendToAll } from './output';
import { TIMINGS, type Ctx, type JoiningPlayer, type RoomState } from './types';
import { snapshotFor } from './views';

/** Joining, reconnecting, leaving, host handover and kicks. Edge cases: docs/product/user-flows.md §9. */

const MAX_NAME_LENGTH = 20;

/** "Ana" → "Ana (2)" when the name is taken (case-insensitive). */
export function uniqueName(state: RoomState, name: string): string {
  const taken = new Set([...state.players.values()].map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = name.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function isConnected(c: Ctx, id: PlayerId): boolean {
  return c.state.players.get(id)?.connected === true;
}

export function onJoin(c: Ctx, joining: JoiningPlayer): void {
  const { state } = c;
  const existing = state.players.get(joining.id);

  if (existing) {
    // Reconnect (or a second tab, which the shell has already swapped in).
    existing.connected = true;
    cancel(c, `grace:${existing.id}`);
    if (state.hostId === existing.id) cancel(c, 'host-grace');
    if (currentDrawerId(c) === existing.id) cancel(c, 'drawer-grace');
    send(c, existing.id, snapshotFor(state, existing.id));
    broadcastPlayers(c);
    checkPlayerCount(c);
    return;
  }

  if (state.banned.has(joining.id)) {
    c.fx.push({ kind: 'disconnect', playerId: joining.id, reason: 'banned' });
    return;
  }
  if (state.players.size >= state.settings.maxPlayers) {
    sendError(c, joining.id, 'ROOM_FULL', 'This room is full');
    c.fx.push({ kind: 'disconnect', playerId: joining.id, reason: 'room_full' });
    return;
  }

  state.players.set(joining.id, {
    id: joining.id,
    name: uniqueName(state, joining.name),
    avatar: joining.avatar,
    isRegistered: joining.isRegistered,
    connected: true,
    joinedAt: c.now,
    score: 0,
    correctGuesses: 0,
    guessTimeMs: 0,
    drawerPoints: 0,
  });
  // The creator holds host rights before connecting. If someone else arrives first and the
  // creator never shows up, host passes on after the grace period.
  if (joining.id === state.hostId) cancel(c, 'host-grace');
  else if (!isConnected(c, state.hostId)) schedule(c, 'host-grace', c.now + TIMINGS.hostGraceMs);
  send(c, joining.id, snapshotFor(state, joining.id));
  broadcastPlayers(c);
  checkPlayerCount(c);
}

export function onDisconnect(c: Ctx, playerId: PlayerId): void {
  const { state } = c;
  const player = state.players.get(playerId);
  if (!player?.connected) return;
  player.connected = false;

  schedule(c, `grace:${playerId}`, c.now + TIMINGS.playerGraceMs);
  if (state.hostId === playerId) schedule(c, 'host-grace', c.now + TIMINGS.hostGraceMs);
  if (currentDrawerId(c) === playerId) {
    schedule(c, 'drawer-grace', c.now + TIMINGS.drawerGraceMs);
  }
  broadcastPlayers(c);
  checkAllSolved(c); // a guesser who left shouldn't hold up the turn
  checkPlayerCount(c);
}

export function transferHost(c: Ctx, newHostId: PlayerId): void {
  c.state.hostId = newHostId;
  cancel(c, 'host-grace');
  sendToAll(c, { t: 'room:notice', code: 'host_changed', playerId: newHostId });
  broadcastPlayers(c);
}

/** The longest-present connected player, or anyone left. */
function pickNewHost(c: Ctx, except: PlayerId): PlayerId | null {
  const others = [...c.state.players.values()].filter((p) => p.id !== except);
  return (others.find((p) => p.connected) ?? others[0])?.id ?? null;
}

export function removePlayer(c: Ctx, playerId: PlayerId): void {
  const { state } = c;
  if (!state.players.delete(playerId)) return;
  cancel(c, `grace:${playerId}`);
  state.kickVotes.delete(playerId);
  for (const voters of state.kickVotes.values()) voters.delete(playerId);

  if (state.players.size === 0) {
    c.fx.push({ kind: 'close' });
    return;
  }
  if (state.hostId === playerId) {
    const next = pickNewHost(c, playerId);
    if (next) transferHost(c, next);
  }
  if (currentDrawerId(c) === playerId) endTurn(c, 'drawer_left');
  else checkAllSolved(c);
  broadcastPlayers(c);
  checkPlayerCount(c);
}

export function kick(c: Ctx, playerId: PlayerId): void {
  c.state.banned.add(playerId);
  c.fx.push({ kind: 'disconnect', playerId, reason: 'kicked' });
  removePlayer(c, playerId);
  sendToAll(c, { t: 'room:notice', code: 'player_kicked', playerId });
}

// ── Timers ──

export function onPlayerGraceTimer(c: Ctx, playerId: PlayerId): void {
  const player = c.state.players.get(playerId);
  if (player && !player.connected) removePlayer(c, playerId);
}

export function onHostGraceTimer(c: Ctx): void {
  const { state } = c;
  if (isConnected(c, state.hostId)) return;
  const next = [...state.players.values()].find((p) => p.connected && p.id !== state.hostId);
  if (next) transferHost(c, next.id);
}

export function onDrawerGraceTimer(c: Ctx): void {
  const drawerId = currentDrawerId(c);
  if (drawerId !== null && !isConnected(c, drawerId)) endTurn(c, 'drawer_left');
}
