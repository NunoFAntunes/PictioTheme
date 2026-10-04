import type { ServerMessage, Stroke } from '@pictiotheme/protocol';

/**
 * The client's copy of the current drawing: a list of operations, mirroring the server's.
 * Lives outside React (rule W9). The drawer applies its own operations here as it draws
 * (the server doesn't echo them back); everyone else applies what the server forwards.
 */

export type DrawOp = Extract<ServerMessage, { t: `draw:${string}` }>;

export type StrokeModel = {
  readonly strokes: readonly Stroke[];
  /** The line stroke still being drawn (its points keep arriving), if any. */
  readonly openId: string | null;
  /** Bumped whenever history is rewritten (reset, undo), so renderers repaint from scratch. */
  readonly epoch: number;
  reset(strokes: readonly Stroke[]): void;
  apply(op: DrawOp): void;
  subscribe(listener: () => void): () => void;
};

export function createStrokeModel(): StrokeModel {
  let strokes: Stroke[] = [];
  let redo: Stroke[] = [];
  let openId: string | null = null;
  let epoch = 0;
  let clearSeq = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    get strokes() {
      return strokes;
    },
    get openId() {
      return openId;
    },
    get epoch() {
      return epoch;
    },

    reset(next) {
      strokes = next.map((s) => ('pts' in s ? { ...s, pts: [...s.pts] } : { ...s }));
      redo = [];
      openId = null;
      epoch += 1;
      emit();
    },

    apply(op) {
      switch (op.t) {
        case 'draw:begin': {
          const { t: _t, x, y, ...style } = op;
          strokes.push({ ...style, pts: [x, y, 0.5] });
          openId = op.id;
          redo = [];
          break;
        }
        case 'draw:pts': {
          for (let i = strokes.length - 1; i >= 0; i--) {
            const s = strokes[i];
            if (s?.id === op.id && 'pts' in s) {
              s.pts.push(...op.pts);
              break;
            }
          }
          break;
        }
        case 'draw:end':
          if (openId === op.id) openId = null;
          break;
        case 'draw:fill': {
          const { t: _t, ...fill } = op;
          openId = null;
          strokes.push({ ...fill, tool: 'fill' });
          redo = [];
          break;
        }
        case 'draw:undo': {
          openId = null;
          const last = strokes.pop();
          if (last) redo.push(last);
          epoch += 1;
          break;
        }
        case 'draw:redo': {
          openId = null;
          const next = redo.pop();
          if (next) strokes.push(next);
          break;
        }
        case 'draw:clear':
          openId = null;
          clearSeq += 1;
          strokes.push({ id: `clear-local-${clearSeq}`, tool: 'clear' });
          redo = [];
          break;
      }
      emit();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
