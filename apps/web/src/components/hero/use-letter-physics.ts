import { useEffect, type RefObject } from 'react';
import {
  isAtRest,
  makeLetterBody,
  step,
  type Bounds,
  type Grab,
  type LetterBody,
  type PointerState,
} from './letter-physics';

/** After this long without a pointermove, the pointer counts as still (it stops nudging). */
const STILL_AFTER_MS = 60;
/** Only wake the loop for hovering this close to the logo. */
const WAKE_MARGIN = 200;

/**
 * Runs letter-physics on the logo's letters: measures where each letter sits, listens to the
 * pointer, and writes transforms straight to the elements (no React render per frame). The loop
 * only runs while something moves. Does nothing for prefers-reduced-motion.
 */
export function useLetterPhysics(
  container: RefObject<HTMLElement | null>,
  letters: RefObject<Array<HTMLElement | null>>,
): void {
  useEffect(() => {
    const stage = container.current;
    const els = letters.current.filter((el): el is HTMLElement => el !== null);
    if (!stage || els.length === 0) return;
    const root: HTMLElement = stage; // narrowed, for the function declarations below
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let bodies: LetterBody[] = [];
    let pointer: PointerState | null = null;
    let nudge = false;
    let grab: Grab | null = null;
    let lastMove = 0;
    let frame = 0;
    let lastFrame = 0;

    // Home spots come from the untransformed layout (offsets ignore transforms).
    function measure() {
      bodies = els.map((el, i) => {
        const { x, y } = offsetWithin(el, root);
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const homeX = x + w / 2;
        const homeY = y + h / 2;
        const r = Math.min(w * 0.45, h * 0.4);
        const prev = bodies[i];
        return prev ? { ...prev, homeX, homeY, r } : makeLetterBody(homeX, homeY, r);
      });
    }

    // Letters may roam the page's width and height, but not off it.
    function bounds(rect: DOMRect): Bounds {
      const top = -(rect.top + window.scrollY);
      return {
        minX: -rect.left,
        maxX: document.documentElement.clientWidth - rect.left,
        minY: top,
        maxY: top + document.documentElement.scrollHeight,
      };
    }

    function render() {
      for (const [i, b] of bodies.entries()) {
        const el = els[i];
        if (!el) continue;
        const scale = grab?.index === i ? 1.08 : 1;
        el.style.transform =
          b.x === 0 && b.y === 0 && b.angle === 0 && scale === 1
            ? ''
            : `translate(${b.x}px, ${b.y}px) rotate(${b.angle}rad) scale(${scale})`;
      }
    }

    function tick(now: number) {
      const dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
      lastFrame = now;
      if (pointer && performance.now() - lastMove > STILL_AFTER_MS) {
        pointer = { ...pointer, vx: 0, vy: 0 };
      }
      bodies = step(bodies, dt, {
        pointer,
        nudge,
        grab,
        bounds: bounds(root.getBoundingClientRect()),
      });
      const pointerMoving = pointer !== null && (pointer.vx !== 0 || pointer.vy !== 0);
      if (grab || pointerMoving || !isAtRest(bodies)) {
        frame = requestAnimationFrame(tick);
      } else {
        bodies = bodies.map((b) => ({ ...b, x: 0, y: 0, vx: 0, vy: 0, angle: 0, va: 0 }));
        frame = 0;
        lastFrame = 0;
      }
      render();
    }

    function wake() {
      if (!frame) frame = requestAnimationFrame(tick);
    }

    function trackPointer(e: PointerEvent) {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      if (pointer && lastMove) {
        const dt = Math.max(now - lastMove, 1) / 1000;
        // Smoothed, so one jittery event doesn't fling a letter across the page.
        pointer = {
          x,
          y,
          vx: pointer.vx * 0.5 + ((x - pointer.x) / dt) * 0.5,
          vy: pointer.vy * 0.5 + ((y - pointer.y) / dt) * 0.5,
        };
      } else {
        pointer = { x, y, vx: 0, vy: 0 };
      }
      lastMove = now;
      nudge = e.pointerType === 'mouse';
      return rect;
    }

    function onMove(e: PointerEvent) {
      const rect = trackPointer(e);
      const near =
        e.clientX > rect.left - WAKE_MARGIN &&
        e.clientX < rect.right + WAKE_MARGIN &&
        e.clientY > rect.top - WAKE_MARGIN &&
        e.clientY < rect.bottom + WAKE_MARGIN;
      if (grab || near) wake();
    }

    function onDown(e: PointerEvent) {
      const el = e.currentTarget as HTMLElement;
      const index = els.indexOf(el);
      const b = bodies[index];
      if (!b || e.button !== 0) return;
      e.preventDefault();
      const rect = trackPointer(e);
      grab = {
        index,
        offsetX: e.clientX - rect.left - (b.homeX + b.x),
        offsetY: e.clientY - rect.top - (b.homeY + b.y),
      };
      el.dataset.grabbed = '';
      el.setPointerCapture(e.pointerId);
      wake();
    }

    function onUp() {
      if (!grab) return;
      const el = els[grab.index];
      if (el) delete el.dataset.grabbed;
      grab = null;
      wake();
    }

    function onLeave() {
      if (!grab) pointer = null;
    }

    measure();
    void document.fonts.ready.then(measure);
    const resize = new ResizeObserver(measure);
    resize.observe(root);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    for (const el of els) el.addEventListener('pointerdown', onDown);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      for (const el of els) {
        el.removeEventListener('pointerdown', onDown);
        el.style.transform = '';
        delete el.dataset.grabbed;
      }
    };
  }, [container, letters]);
}

/** The element's layout position relative to a positioned ancestor, ignoring transforms. */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}
