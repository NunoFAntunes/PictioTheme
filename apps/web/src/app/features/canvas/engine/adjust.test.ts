import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOL, type ToolSettings } from '../tools';
import { AXIS_LOCK_PX, adjustByDrag, lockAxis, stepSize, stepTolerance } from './adjust';

const brush: ToolSettings = { ...DEFAULT_TOOL, tool: 'brush', size: 8, opacity: 0.5 };

describe('lockAxis', () => {
  it('waits until the pointer has moved far enough', () => {
    expect(lockAxis(AXIS_LOCK_PX - 1, 0, null)).toBeNull();
    expect(lockAxis(AXIS_LOCK_PX, 2, null)).toBe('horizontal');
    expect(lockAxis(-2, -AXIS_LOCK_PX, null)).toBe('vertical');
  });

  it('keeps the first axis for the rest of the gesture', () => {
    expect(lockAxis(0, 300, 'horizontal')).toBe('horizontal');
  });
});

describe('adjustByDrag', () => {
  it('changes nothing before an axis is locked', () => {
    expect(adjustByDrag(brush, null, 3, 3)).toEqual({});
  });

  it('doubles the size every 50 px to the right and halves it to the left', () => {
    expect(adjustByDrag(brush, 'horizontal', 50, 0)).toEqual({ size: 16 });
    expect(adjustByDrag(brush, 'horizontal', -50, 0)).toEqual({ size: 4 });
    expect(adjustByDrag(brush, 'horizontal', 0, 0)).toEqual({ size: 8 });
  });

  it('clamps size to the protocol limits', () => {
    expect(adjustByDrag(brush, 'horizontal', 1000, 0)).toEqual({ size: 64 });
    expect(adjustByDrag(brush, 'horizontal', -1000, 0)).toEqual({ size: 1 });
  });

  it('makes the brush more opaque dragging up, clamped to 5–100%', () => {
    const up = adjustByDrag(brush, 'vertical', 0, -100).opacity ?? 0;
    expect(up).toBeCloseTo(0.98, 2);
    expect(adjustByDrag(brush, 'vertical', 0, 1000)).toEqual({ opacity: 0.05 });
    expect(adjustByDrag(brush, 'vertical', 0, -1000)).toEqual({ opacity: 1 });
  });

  it('adjusts the eraser like the brush', () => {
    const eraser = { ...brush, tool: 'eraser' as const };
    expect(adjustByDrag(eraser, 'horizontal', 50, 0)).toEqual({ size: 16 });
  });

  it('changes fill tolerance horizontally and nothing vertically', () => {
    const fill = { ...brush, tool: 'fill' as const, fillTolerance: 32 };
    expect(adjustByDrag(fill, 'horizontal', 40, 0)).toEqual({ fillTolerance: 72 });
    expect(adjustByDrag(fill, 'horizontal', -400, 0)).toEqual({ fillTolerance: 0 });
    expect(adjustByDrag(fill, 'vertical', 0, -100)).toEqual({});
  });
});

describe('stepSize', () => {
  it('always moves by at least 1 at small sizes', () => {
    expect(stepSize(1, 1, false)).toBe(2);
    expect(stepSize(2, -1, false)).toBe(1);
  });

  it('steps proportionally, and doubles or halves with Shift', () => {
    expect(stepSize(32, 1, false)).toBe(38);
    expect(stepSize(8, 1, true)).toBe(16);
    expect(stepSize(8, -1, true)).toBe(4);
  });

  it('stays within limits', () => {
    expect(stepSize(64, 1, true)).toBe(64);
    expect(stepSize(1, -1, false)).toBe(1);
  });
});

describe('stepTolerance', () => {
  it('steps by 8, or 32 with Shift, within 0–255', () => {
    expect(stepTolerance(32, 1, false)).toBe(40);
    expect(stepTolerance(32, -1, true)).toBe(0);
    expect(stepTolerance(250, 1, false)).toBe(255);
  });
});
