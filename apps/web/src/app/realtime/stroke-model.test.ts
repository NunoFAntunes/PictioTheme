import { describe, expect, it, vi } from 'vitest';
import { createStrokeModel } from './stroke-model';

const begin = {
  t: 'draw:begin',
  id: 's1',
  tool: 'brush',
  color: '#000000',
  size: 8,
  opacity: 1,
  x: 1,
  y: 2,
} as const;

describe('stroke model', () => {
  it('builds a stroke from begin, points and end', () => {
    const model = createStrokeModel();
    model.apply(begin);
    expect(model.openId).toBe('s1');
    model.apply({ t: 'draw:pts', id: 's1', pts: [3, 4, 0.5] });
    model.apply({ t: 'draw:end', id: 's1' });
    expect(model.openId).toBeNull();
    expect(model.strokes).toEqual([
      {
        id: 's1',
        tool: 'brush',
        color: '#000000',
        size: 8,
        opacity: 1,
        pts: [1, 2, 0.5, 3, 4, 0.5],
      },
    ]);
  });

  it('undo bumps the epoch so renderers repaint, redo restores', () => {
    const model = createStrokeModel();
    model.apply({ t: 'draw:fill', id: 'f1', x: 1, y: 1, color: '#ff0000', tolerance: 0 });
    const epoch = model.epoch;
    model.apply({ t: 'draw:undo' });
    expect(model.strokes).toHaveLength(0);
    expect(model.epoch).toBe(epoch + 1);
    model.apply({ t: 'draw:redo' });
    expect(model.strokes.map((s) => s.tool)).toEqual(['fill']);
  });

  it('a new operation clears the redo stack', () => {
    const model = createStrokeModel();
    model.apply({ t: 'draw:fill', id: 'f1', x: 1, y: 1, color: '#ff0000', tolerance: 0 });
    model.apply({ t: 'draw:undo' });
    model.apply({ t: 'draw:clear' });
    model.apply({ t: 'draw:redo' });
    expect(model.strokes.map((s) => s.tool)).toEqual(['clear']);
  });

  it('reset copies the strokes (later points never mutate the snapshot) and notifies', () => {
    const model = createStrokeModel();
    const listener = vi.fn();
    model.subscribe(listener);
    const snapshot = [
      { id: 's1', tool: 'brush' as const, color: '#000000', size: 8, opacity: 1, pts: [1, 2, 0.5] },
    ];
    model.reset(snapshot);
    model.apply({ t: 'draw:pts', id: 's1', pts: [5, 5, 0.5] });
    expect(snapshot[0]?.pts).toEqual([1, 2, 0.5]);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
