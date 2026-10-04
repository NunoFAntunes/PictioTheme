import { describe, expect, it } from 'vitest';
import { createStrokeModel } from '../../realtime';
import { pencilLevel, watchDrawing } from './drawing-sounds';

function setup() {
  const model = createStrokeModel();
  const events: string[] = [];
  let clock = 0;
  let pending: (() => void) | null = null;
  const stop = watchDrawing(
    model,
    {
      scribble: (level, tool) => events.push(`scribble ${tool} ${level.toFixed(2)}`),
      quiet: () => events.push('quiet'),
      fill: () => events.push('fill'),
    },
    () => clock,
    {
      set: (fn) => {
        pending = fn;
      },
      clear: () => {
        pending = null;
      },
    },
  );
  return {
    model,
    events,
    stop,
    advance: (ms: number) => {
      clock += ms;
    },
    fireStillTimer: () => pending?.(),
  };
}

const begin = (id: string, tool: 'brush' | 'eraser' = 'brush') =>
  ({ t: 'draw:begin', id, tool, color: '#000000', size: 8, opacity: 1, x: 0, y: 0 }) as const;

describe('drawing sounds', () => {
  it('scribbles while the line moves, louder when faster, and goes quiet on lift', () => {
    const { model, events, advance } = setup();
    model.apply(begin('s1'));
    expect(events).toEqual([]); // landing the pencil isn't movement
    advance(33);
    model.apply({ t: 'draw:pts', id: 's1', pts: [10, 0, 0.5] });
    advance(33);
    model.apply({ t: 'draw:pts', id: 's1', pts: [60, 0, 0.5] });
    model.apply({ t: 'draw:end', id: 's1' });
    expect(events).toEqual(['scribble brush 0.20', 'scribble brush 1.00', 'quiet']);
  });

  it('goes quiet when the pencil holds still, and rubs with the eraser', () => {
    const { model, events, advance, fireStillTimer } = setup();
    model.apply(begin('s1', 'eraser'));
    advance(33);
    model.apply({ t: 'draw:pts', id: 's1', pts: [20, 0, 0.5] });
    fireStillTimer();
    expect(events).toEqual(['scribble eraser 0.40', 'quiet']);
  });

  it('glugs on a fill, but not when history is reset or undone', () => {
    const { model, events } = setup();
    const fill = {
      t: 'draw:fill',
      id: 'f1',
      x: 1,
      y: 1,
      color: '#ff0000',
      tolerance: 0.1,
    } as const;
    model.apply(fill);
    expect(events).toEqual(['fill']);
    model.apply({ t: 'draw:undo' });
    model.reset([{ id: 'f2', x: 1, y: 1, color: '#ff0000', tolerance: 0.1, tool: 'fill' }]);
    expect(events.filter((e) => e === 'fill')).toHaveLength(1);
  });

  it('maps speed to a level between 0 and 1', () => {
    expect(pencilLevel(0, 33)).toBe(0);
    expect(pencilLevel(25, 33)).toBeCloseTo(0.505, 2);
    expect(pencilLevel(500, 33)).toBe(1);
  });
});
