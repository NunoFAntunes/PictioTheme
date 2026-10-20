import { DEFAULT_TUNING } from '@pictiotheme/tower-physics';
import { sendToRoom } from '../../realtime';

/**
 * The placer's controls (game-rules.md#placing): ←/→ or A/D move, ↑ or W rotates 15° clockwise
 * (Q/E: either way), ↓ or S lowers faster, Space drops. The target is kept here and sent at most 20 times a second; the tower view
 * draws the piece at it straight away (`target()`), and the server's frames catch up.
 */

const MOVE_SPEED = 3; // m/s, while ←/→ is held
const ROTATE_STEP = Math.PI / 12;
const SEND_MS = 50;
const LIMIT = DEFAULT_TUNING.platformWidth / 2 + DEFAULT_TUNING.reach;

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

export type PlacementController = ReturnType<typeof createPlacementController>;

export function createPlacementController() {
  let active = false;
  const held = { left: false, right: false, fast: false };
  const target = { x: 0, angle: 0 };
  let dirty = false;
  let lastSent = 0;
  let frame = 0;
  let last = 0;

  const sendNow = () => {
    dirty = false;
    lastSent = performance.now();
    sendToRoom({ t: 'place:steer', x: target.x, angle: target.angle, fast: held.fast });
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0);
    last = now;
    if (!active) return;
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (dir !== 0) {
      target.x = Math.min(LIMIT, Math.max(-LIMIT, target.x + dir * MOVE_SPEED * dt));
      dirty = true;
    }
    if (dirty && now - lastSent >= SEND_MS) sendNow();
  };

  const controller = {
    /** A new piece to place (or none): the target starts over the middle, upright. */
    setActive(on: boolean): void {
      if (on && !active) {
        target.x = 0;
        target.angle = 0;
      }
      active = on;
      if (!on) {
        held.left = held.right = held.fast = false;
      }
    },
    hold(control: 'left' | 'right' | 'fast', down: boolean): void {
      if (!active || held[control] === down) return;
      held[control] = down;
      if (control === 'fast') sendNow();
    },
    rotate(direction: 1 | -1): void {
      if (!active) return;
      target.angle += direction * ROTATE_STEP;
      sendNow();
    },
    drop(): void {
      if (active) sendToRoom({ t: 'place:drop' });
    },
    /** Where the piece is being steered, while placing. */
    target(): { x: number; angle: number } | null {
      return active ? { ...target } : null;
    },
    /** Keyboard control. Returns a function that detaches it. */
    attach(): () => void {
      const onKey = (e: KeyboardEvent) => {
        if (!active || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
        const down = e.type === 'keydown';
        const hold = HOLD[e.code];
        const turn = ROTATE[e.code];
        if (hold) {
          e.preventDefault();
          controller.hold(hold, down);
        } else if (e.code === 'Space') {
          e.preventDefault();
          if (down && !e.repeat) controller.drop();
        } else if (turn) {
          e.preventDefault();
          if (down) controller.rotate(turn);
        }
      };
      const onBlur = () => {
        held.left = held.right = false;
      };
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      window.addEventListener('blur', onBlur);
      frame = requestAnimationFrame(tick);
      return () => {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        window.removeEventListener('blur', onBlur);
        cancelAnimationFrame(frame);
      };
    },
  };
  return controller;
}
