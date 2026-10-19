/**
 * Which pointer may draw (drawing-tools.md#touch-and-stylus). Tablets send several pointers at
 * once: a pen, the palm resting on the screen, a second finger. The gate keeps one pointer in
 * charge of a stroke and rejects the palm:
 *
 * - One active pointer at a time. Other pointers' moves and lifts are ignored, so a palm landing
 *   or lifting mid-stroke can't add points to the stroke or end it.
 * - Palm rejection: once a pen has been seen (a press or a hover, which Apple Pencil reports
 *   before touching), touches no longer draw for the rest of the page's life. Fingers still work
 *   everywhere else (toolbar, buttons).
 * - Pressure: only a pen's pressure is real. Mice and fingers report 0.5, so perfect-freehand
 *   simulates pressure from speed instead (some touch screens report a constant 1).
 */

type PointerInfo = { pointerId: number; pointerType: string };

export type PointerGate = ReturnType<typeof createPointerGate>;

export function createPointerGate() {
  let active: number | null = null;
  let penSeen = false;

  return {
    /** Any pointer event over the canvas: a pen hovering is enough to start rejecting palms. */
    observe(e: PointerInfo): void {
      if (e.pointerType === 'pen') penSeen = true;
    },

    /** A press: true if this pointer takes charge (and becomes the active one). */
    claim(e: PointerInfo): boolean {
      this.observe(e);
      if (active !== null) return false;
      if (e.pointerType === 'touch' && penSeen) return false;
      active = e.pointerId;
      return true;
    },

    /** True for events from the pointer in charge. */
    owns(e: { pointerId: number }): boolean {
      return active !== null && e.pointerId === active;
    },

    release(): void {
      active = null;
    },

    get penSeen(): boolean {
      return penSeen;
    },
  };
}

/** The pressure to record for a point: a pen's real pressure, or the neutral 0.5. */
export function pointPressure(e: { pointerType: string; pressure: number }): number {
  return e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
}
