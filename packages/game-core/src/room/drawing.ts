import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type ClientMessage,
  type PlayerId,
  type Stroke,
} from '@pictiotheme/protocol';
import { sendError, sendToAll } from './output';
import { MAX_POINTS_PER_TURN, type Ctx } from './types';

/**
 * Drawing operations from the drawer. The server keeps the stroke list (for late joiners and
 * reconnects) and forwards each operation to everyone else. Spec: realtime-protocol.md#drawing-sync.
 */

export type DrawMessage = Extract<ClientMessage, { t: `draw:${string}` }>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

/** Charges points against the per-turn budget. False (and an error) when it's spent. */
function reservePoints(c: Ctx, drawerId: PlayerId, count: number): boolean {
  if (c.state.pointsThisTurn + count > MAX_POINTS_PER_TURN) {
    sendError(c, drawerId, 'RATE_LIMITED', 'This drawing is too detailed');
    return false;
  }
  c.state.pointsThisTurn += count;
  return true;
}

function lastLineStroke(strokes: Stroke[], id: string) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    if (s?.id === id && (s.tool === 'brush' || s.tool === 'eraser')) return s;
  }
  return null;
}

export function onDraw(c: Ctx, playerId: PlayerId, msg: DrawMessage): void {
  const { state } = c;
  const { phase } = state;
  if (phase.kind !== 'drawing' || state.paused) {
    sendError(c, playerId, 'WRONG_PHASE', 'You can only draw during your turn');
    return;
  }
  if (phase.drawerId !== playerId) {
    sendError(c, playerId, 'NOT_DRAWER', 'Only the drawer can draw');
    return;
  }
  const forward = (m: Parameters<typeof sendToAll>[1]) => sendToAll(c, m, playerId);

  switch (msg.t) {
    case 'draw:begin': {
      if (!reservePoints(c, playerId, 1)) return;
      const { t: _t, x, y, ...style } = msg;
      state.strokes.push({ ...style, pts: [x, y, 0.5] });
      state.redo = [];
      forward(msg);
      return;
    }
    case 'draw:pts': {
      const stroke = lastLineStroke(state.strokes, msg.id);
      if (!stroke) return;
      const pts = clampPoints(msg.pts);
      if (pts.length === 0 || !reservePoints(c, playerId, pts.length / 3)) return;
      stroke.pts.push(...pts);
      forward({ t: 'draw:pts', id: msg.id, pts });
      return;
    }
    case 'draw:end':
      forward(msg);
      return;
    case 'draw:fill': {
      if (!reservePoints(c, playerId, 1)) return;
      const { t: _t, ...fill } = msg;
      state.strokes.push({ ...fill, tool: 'fill' });
      state.redo = [];
      forward(msg);
      return;
    }
    case 'draw:undo': {
      const op = state.strokes.pop();
      if (!op) return;
      state.redo.push(op);
      forward(msg);
      return;
    }
    case 'draw:redo': {
      const op = state.redo.pop();
      if (!op) return;
      state.strokes.push(op);
      forward(msg);
      return;
    }
    case 'draw:clear': {
      if (state.strokes.length === 0) return;
      state.opSeq += 1;
      state.strokes.push({ id: `clear-${state.opSeq}`, tool: 'clear' });
      state.redo = [];
      forward(msg);
      return;
    }
  }
}
