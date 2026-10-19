import { describe, expect, it } from 'vitest';
import { createPointerGate, pointPressure } from './pointer-gate';

const pen = { pointerId: 1, pointerType: 'pen' };
const palm = { pointerId: 2, pointerType: 'touch' };
const finger = { pointerId: 3, pointerType: 'touch' };
const mouse = { pointerId: 4, pointerType: 'mouse' };

describe('pointer gate', () => {
  it('lets one pointer at a time take charge', () => {
    const gate = createPointerGate();
    expect(gate.claim(finger)).toBe(true);
    expect(gate.claim(mouse)).toBe(false);
    expect(gate.owns(finger)).toBe(true);
    expect(gate.owns(mouse)).toBe(false);
    gate.release();
    expect(gate.claim(mouse)).toBe(true);
  });

  it('ignores a palm that lands while the pen draws', () => {
    const gate = createPointerGate();
    expect(gate.claim(pen)).toBe(true);
    expect(gate.claim(palm)).toBe(false);
    expect(gate.owns(palm)).toBe(false); // its moves and lift don't touch the stroke
  });

  it('stops touches from drawing once a pen has been seen, even just hovering', () => {
    const gate = createPointerGate();
    expect(gate.claim(finger)).toBe(true); // fingers draw on a device without a pen
    gate.release();
    gate.observe(pen); // Apple Pencil hovering above the screen
    expect(gate.penSeen).toBe(true);
    expect(gate.claim(palm)).toBe(false);
    expect(gate.claim(pen)).toBe(true);
  });

  it('records real pressure for pens only', () => {
    expect(pointPressure({ pointerType: 'pen', pressure: 0.83 })).toBe(0.83);
    expect(pointPressure({ pointerType: 'pen', pressure: 0 })).toBe(0.5);
    expect(pointPressure({ pointerType: 'touch', pressure: 1 })).toBe(0.5);
    expect(pointPressure({ pointerType: 'mouse', pressure: 0.5 })).toBe(0.5);
  });
});
