import { describe, expect, it } from 'vitest';
import { applyShortcut, shortcutFor, type KeyInput } from './shortcuts';
import { DEFAULT_TOOL, withColor } from './tools';

const key = (k: string, code: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe('shortcutFor', () => {
  it('steps size by physical key, whatever the layout prints', () => {
    // Portuguese layout: the key right of P types "+" but is still BracketRight.
    expect(shortcutFor(key('+', 'BracketRight'))).toEqual({
      kind: 'size',
      direction: 1,
      big: false,
    });
    expect(shortcutFor(key('-', 'Minus'))).toEqual({ kind: 'size', direction: -1, big: false });
    expect(shortcutFor(key('{', 'BracketLeft', { shiftKey: true }))).toEqual({
      kind: 'size',
      direction: -1,
      big: true,
    });
  });

  it('uses colour slots 1–5 by physical key, and saves to them with Shift', () => {
    expect(shortcutFor(key('1', 'Digit1'))).toEqual({ kind: 'slot', slot: 0, save: false });
    // AZERTY: the unshifted key types "&" but is still Digit1; Shift types "1" and saves.
    expect(shortcutFor(key('&', 'Digit1'))).toEqual({ kind: 'slot', slot: 0, save: false });
    expect(shortcutFor(key('5', 'Digit5', { shiftKey: true }))).toEqual({
      kind: 'slot',
      slot: 4,
      save: true,
    });
    expect(shortcutFor(key('3', 'Numpad3'))).toEqual({ kind: 'slot', slot: 2, save: false });
    // 6–9 and 0 do nothing (they used to set opacity: drag on the canvas for that now).
    expect(shortcutFor(key('6', 'Digit6'))).toBeNull();
    expect(shortcutFor(key('0', 'Digit0'))).toBeNull();
  });

  it('ignores AltGr combinations (which is how some layouts type [ and ])', () => {
    expect(shortcutFor(key('[', 'Digit8', { altKey: true, ctrlKey: true }))).toBeNull();
    expect(shortcutFor(key('[', 'Digit8', { altKey: true }))).toBeNull();
  });

  it('picks tools with Q W E by physical key, keeping B and F by the printed letter', () => {
    expect(shortcutFor(key('q', 'KeyQ'))).toEqual({ kind: 'tool', tool: 'brush' });
    expect(shortcutFor(key('w', 'KeyW'))).toEqual({ kind: 'tool', tool: 'fill' });
    expect(shortcutFor(key('E', 'KeyE'))).toEqual({ kind: 'tool', tool: 'eraser' });
    // AZERTY: the same three keys print A, Z, E.
    expect(shortcutFor(key('a', 'KeyQ'))).toEqual({ kind: 'tool', tool: 'brush' });
    expect(shortcutFor(key('z', 'KeyW'))).toEqual({ kind: 'tool', tool: 'fill' });
    expect(shortcutFor(key('b', 'KeyB'))).toEqual({ kind: 'tool', tool: 'brush' });
    expect(shortcutFor(key('f', 'KeyF'))).toEqual({ kind: 'tool', tool: 'fill' });
    expect(shortcutFor(key('Q', 'KeyQ', { shiftKey: true }))).toBeNull();
  });

  it('swaps colours with X and opens the colour popover with C', () => {
    expect(shortcutFor(key('x', 'KeyX'))).toEqual({ kind: 'swap-color' });
    expect(shortcutFor(key('c', 'KeyC'))).toEqual({ kind: 'color-popover' });
    expect(shortcutFor(key('c', 'KeyC', { metaKey: true }))).toBeNull(); // copy
    expect(shortcutFor(key('X', 'KeyX', { shiftKey: true }))).toBeNull();
  });

  it('handles undo/redo and leaves other browser shortcuts alone', () => {
    expect(shortcutFor(key('z', 'KeyZ', { metaKey: true }))).toEqual({ kind: 'undo' });
    expect(shortcutFor(key('Z', 'KeyZ', { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: 'redo',
    });
    expect(shortcutFor(key('=', 'Equal', { ctrlKey: true }))).toBeNull(); // browser zoom
    expect(shortcutFor(key('1', 'Digit1', { metaKey: true }))).toBeNull(); // tab switch
  });
});

describe('applyShortcut', () => {
  it('steps size for the brush and tolerance for fill', () => {
    const size = { kind: 'size', direction: 1, big: false } as const;
    expect(applyShortcut({ ...DEFAULT_TOOL, size: 8 }, size).size).toBe(10);
    const fill = applyShortcut({ ...DEFAULT_TOOL, tool: 'fill', fillTolerance: 32 }, size);
    expect(fill.fillTolerance).toBe(40);
    expect(fill.size).toBe(DEFAULT_TOOL.size);
  });

  it('swaps back and forth between the last two colours', () => {
    const red = withColor(DEFAULT_TOOL, '#dc2626');
    const swapped = applyShortcut(red, { kind: 'swap-color' });
    expect(swapped.color).toBe(DEFAULT_TOOL.color);
    expect(applyShortcut(swapped, { kind: 'swap-color' }).color).toBe('#dc2626');
    // Nothing to swap to yet.
    expect(applyShortcut(DEFAULT_TOOL, { kind: 'swap-color' })).toBe(DEFAULT_TOOL);
  });
});
