import type { SandboxSession } from './session';

/**
 * Placement keys (docs/tower/product/game-rules.md#placing): ←/→ or A/D move, ↑ or W rotates 15°
 * clockwise (Q/E: either way), ↓ or S lowers faster, Space drops. Ignored while typing in a field or using a slider, so the
 * tuning panel's arrow keys still work.
 */

const HOLD: Record<string, 'left' | 'right' | 'fast'> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'fast',
  KeyS: 'fast',
};

/** Positive angles turn the piece anticlockwise (the physics' y axis points up). */
const ROTATE: Record<string, 1 | -1> = { ArrowUp: -1, KeyW: -1, KeyE: -1, KeyQ: 1 };

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function attachPlacementKeys(session: SandboxSession): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const down = e.type === 'keydown';
    const hold = HOLD[e.code];
    if (hold) {
      e.preventDefault();
      session.hold(hold, down);
      return;
    }
    if (e.code === 'Space') {
      // Also on keyup: a focused button would otherwise "click" on Space.
      e.preventDefault();
      if (down && !e.repeat) session.drop();
      return;
    }
    const turn = ROTATE[e.code];
    if (turn) {
      e.preventDefault();
      if (down) session.rotate(turn);
    }
  };
  // Letting go of everything when the window loses focus, so a key isn't stuck held.
  const onBlur = () => {
    session.hold('left', false);
    session.hold('right', false);
    session.hold('fast', false);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', onBlur);
  };
}
