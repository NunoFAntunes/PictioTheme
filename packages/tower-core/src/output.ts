import type { ErrorCode, PlayerId } from '@pictiotheme/protocol';
import type { Team, TowerServerMessage } from '@pictiotheme/protocol/tower';
import type { Ctx, TimerId } from './types';
import { publicPlayers } from './views';

/** Small helpers that append effects. */

export function send(c: Ctx, to: PlayerId | PlayerId[], msg: TowerServerMessage): void {
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length > 0) c.fx.push({ kind: 'send', to: recipients, msg });
}

export function connectedIds(c: Ctx, except?: PlayerId): PlayerId[] {
  const ids: PlayerId[] = [];
  for (const p of c.state.players.values()) if (p.connected && p.id !== except) ids.push(p.id);
  return ids;
}

/** Connected members of a crew. */
export function crewIds(c: Ctx, team: Team): PlayerId[] {
  const ids: PlayerId[] = [];
  for (const p of c.state.players.values()) if (p.connected && p.team === team) ids.push(p.id);
  return ids;
}

export function sendToAll(c: Ctx, msg: TowerServerMessage, except?: PlayerId): void {
  send(c, connectedIds(c, except), msg);
}

export function sendError(c: Ctx, to: PlayerId, code: ErrorCode, message: string): void {
  send(c, to, { t: 'error', code, message });
}

export function broadcastPlayers(c: Ctx): void {
  sendToAll(c, { t: 'room:players', players: publicPlayers(c.state), hostId: c.state.hostId });
}

export function schedule(c: Ctx, timer: TimerId, at: number): void {
  c.fx.push({ kind: 'schedule', timer, at });
}

export function cancel(c: Ctx, timer: TimerId): void {
  c.fx.push({ kind: 'cancel', timer });
}
