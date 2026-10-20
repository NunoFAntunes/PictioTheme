import { CANVAS_HEIGHT, CANVAS_WIDTH, type PlayerId, type Stroke } from '@pictiotheme/protocol';
import type { TowerClientMessage, TowerDrawOp } from '@pictiotheme/protocol/tower';
import { sendError, sendToAll } from './output';
import { MAX_POINTS_PER_ROUND, type Ctx, type Round } from './types';

/**
 * A drawer's strokes. The server keeps each crew's drawing (for reconnects, and to make the piece
 * from) and forwards every operation to everyone else, tagged with the crew: both crews watch
 * both drawings. Same rules as DoodleWhirl's (game-core room/drawing.ts). The server can't see
 * pixels, so it keeps every fill; clients skip one that isn't inside a closed shape.
 */

export type DrawMessage = Extract<TowerClientMessage, { t: `draw:${string}` }>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Snaps points into the logical canvas. Drops triplets that aren't finite numbers. */
function clampPoints(pts: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < pts.length; i += 3) {
    const x = pts[i] as number;
    const y = pts[i + 1] as number;
    const p = pts[i + 2] as number;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(p)) continue;
    out.push(
      clamp(Math.round(x), 0, CANVAS_WIDTH),
      clamp(Math.round(y), 0, CANVAS_HEIGHT),
      clamp(p, 0, 1),
    );
  }
  return out;
}

function lastLineStroke(strokes: Stroke[], id: string) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    if (s?.id === id && (s.tool === 'brush' || s.tool === 'eraser')) return s;
  }
  return null;
}

/** The drawer's crew's round, or null (with an error for anyone who isn't drawing). */
function drawerRound(c: Ctx, playerId: PlayerId) {
  const team = c.state.players.get(playerId)?.team;
  const round = team ? c.state.match?.crews[team].round : null;
  if (!team || !round) return null; // strokes in flight as a round ends: drop them quietly
  if (round.drawerId !== playerId) {
    sendError(c, playerId, 'NOT_DRAWER', 'Only the drawer can draw');
    return null;
  }
  return { team, round };
}

function reservePoints(c: Ctx, round: Round, playerId: PlayerId, count: number): boolean {
  if (round.points + count > MAX_POINTS_PER_ROUND) {
    sendError(c, playerId, 'RATE_LIMITED', 'This drawing is too detailed');
    return false;
  }
  round.points += count;
  return true;
}

export function onDraw(c: Ctx, playerId: PlayerId, msg: DrawMessage): void {
  if (c.state.phase !== 'playing') return;
  const found = drawerRound(c, playerId);
  if (!found) return;
  const { team, round } = found;
  const forward = (op: TowerDrawOp) => sendToAll(c, { t: 'crew:draw', team, op }, playerId);

  switch (msg.t) {
    case 'draw:begin': {
      if (!reservePoints(c, round, playerId, 1)) return;
      const { t: _t, x, y, ...style } = msg;
      round.strokes.push({ ...style, pts: [x, y, 0.5] });
      round.redo = [];
      forward(msg);
      return;
    }
    case 'draw:pts': {
      const stroke = lastLineStroke(round.strokes, msg.id);
      if (!stroke) return;
      const pts = clampPoints(msg.pts);
      if (pts.length === 0 || !reservePoints(c, round, playerId, pts.length / 3)) return;
      stroke.pts.push(...pts);
      forward({ t: 'draw:pts', id: msg.id, pts });
      return;
    }
    case 'draw:end':
      forward(msg);
      return;
    case 'draw:fill': {
      if (!reservePoints(c, round, playerId, 1)) return;
      const { t: _t, ...fill } = msg;
      round.strokes.push({ ...fill, tool: 'fill' });
      round.redo = [];
      forward(msg);
      return;
    }
    case 'draw:undo': {
      const op = round.strokes.pop();
      if (!op) return;
      round.redo.push(op);
      forward(msg);
      return;
    }
    case 'draw:redo': {
      const op = round.redo.pop();
      if (!op) return;
      round.strokes.push(op);
      forward(msg);
      return;
    }
    case 'draw:clear': {
      if (round.strokes.length === 0) return;
      round.strokes.push({ id: `clear-${round.id}-${round.strokes.length}`, tool: 'clear' });
      round.redo = [];
      forward(msg);
      return;
    }
  }
}
