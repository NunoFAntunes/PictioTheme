import type { ToolSettings } from '../tools';

/**
 * The brush preview over the canvas (drawing-tools.md#cursor-preview): a ring the exact size a
 * stroke will be on screen, at the pointer.
 *
 * While the drawer changes a setting it is "emphasised": filled with the real colour at the real
 * opacity, with a "24 px · 60%" label. During the adjust drag it stays pinned where the drag began.
 * A change from the keyboard or the toolbar flashes it (at the pointer, or the canvas centre),
 * so every way of changing the size shows the actual size.
 *
 * While the eyedropper is active it shows the colour under the pointer instead: a fixed-size
 * swatch with its hex code.
 *
 * Plain DOM inside `host` (an empty element over the canvas that React leaves alone),
 * positioned on each pointer move without React (rule W9).
 */

export type BrushCursor = {
  setTool(tool: ToolSettings): void;
  setEnabled(enabled: boolean): void;
  /** The pointer moved over the canvas (mouse and pen only: touch has no hover). */
  hover(clientX: number, clientY: number): void;
  leave(): void;
  /** Where the pointer is over the canvas (client coordinates), if it is. */
  pointerAt(): { x: number; y: number } | null;
  /** Adjust drag: pin the emphasised ring at a point until `unpin`. */
  pin(clientX: number, clientY: number): void;
  unpin(): void;
  /** Eyedropper preview: show this colour at the pointer, or null to go back to the brush. */
  preview(color: string | null): void;
  /** Emphasise briefly after a setting changed. */
  flash(): void;
  destroy(): void;
};

const FLASH_MS = 900;
const LABEL_GAP = 8;
const LABEL_HEIGHT = 22;
const LABEL_HALF_WIDTH = 48;
const PREVIEW_DIAMETER = 28;

export function cursorLabel(tool: ToolSettings): string {
  if (tool.tool === 'fill') return `Tolerance ${tool.fillTolerance}`;
  return `${tool.size} px · ${Math.round(tool.opacity * 100)}%`;
}

export function createBrushCursor(canvas: HTMLCanvasElement, host: HTMLElement): BrushCursor {
  const ring = document.createElement('div');
  ring.dataset.testid = 'brush-cursor';
  ring.setAttribute('aria-hidden', 'true');
  ring.className =
    'pointer-events-none absolute top-0 left-0 rounded-full border border-zinc-900/70 shadow-[0_0_0_1px_rgb(255_255_255/0.8)]';
  const fill = document.createElement('div');
  fill.className = 'absolute inset-0 rounded-full';
  ring.append(fill);

  const label = document.createElement('div');
  label.dataset.testid = 'brush-cursor-label';
  label.setAttribute('aria-hidden', 'true');
  label.className =
    'pointer-events-none absolute top-0 left-0 rounded-full bg-zinc-900/85 px-2 py-0.5 text-xs whitespace-nowrap text-white tabular-nums';

  host.append(ring, label);

  let tool: ToolSettings | null = null;
  let enabled = false;
  let pointer: { x: number; y: number } | null = null;
  let pinned: { x: number; y: number } | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let flashing = false;
  let previewColor: string | null = null;

  const render = () => {
    const where = pinned ?? pointer;
    const emphasised = pinned !== null || flashing;
    if (!enabled || !tool || (!where && !emphasised)) {
      ring.hidden = true;
      label.hidden = true;
      return;
    }

    const hostRect = host.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const x = (where ? where.x : canvasRect.left + canvasRect.width / 2) - hostRect.left;
    const y = (where ? where.y : canvasRect.top + canvasRect.height / 2) - hostRect.top;

    let radius = 0;
    if (previewColor && pointer && !pinned) {
      radius = PREVIEW_DIAMETER / 2;
      ring.hidden = false;
      ring.style.width = `${PREVIEW_DIAMETER}px`;
      ring.style.height = `${PREVIEW_DIAMETER}px`;
      ring.style.transform = `translate(${x - radius}px, ${y - radius}px)`;
      ring.style.borderStyle = 'solid';
      fill.style.backgroundColor = previewColor;
      fill.style.opacity = '1';
      label.hidden = false;
      label.textContent = previewColor;
      placeLabel(x, y, radius, hostRect);
      return;
    }

    // Fill has no brush size: only the label.
    ring.hidden = tool.tool === 'fill';
    if (tool.tool !== 'fill') {
      const diameter = Math.max(2, (tool.size * canvasRect.width) / canvas.width);
      radius = diameter / 2;
      ring.style.width = `${diameter}px`;
      ring.style.height = `${diameter}px`;
      ring.style.transform = `translate(${x - radius}px, ${y - radius}px)`;
      ring.style.borderStyle = tool.tool === 'eraser' ? 'dashed' : 'solid';
      fill.style.backgroundColor = tool.tool === 'eraser' ? '#ffffff' : tool.color;
      fill.style.opacity = emphasised ? String(tool.opacity) : '0';
    }

    label.hidden = !emphasised;
    if (emphasised) {
      label.textContent = cursorLabel(tool);
      placeLabel(x, y, radius, hostRect);
    }
  };

  // Below the ring, or above it near the bottom edge; never off the sides.
  const placeLabel = (x: number, y: number, radius: number, hostRect: DOMRect) => {
    const below = y + radius + LABEL_GAP;
    const top =
      below + LABEL_HEIGHT > hostRect.height ? y - radius - LABEL_GAP - LABEL_HEIGHT : below;
    const left = Math.min(
      Math.max(x, LABEL_HALF_WIDTH),
      Math.max(LABEL_HALF_WIDTH, hostRect.width - LABEL_HALF_WIDTH),
    );
    label.style.transform = `translate(calc(${left}px - 50%), ${Math.max(0, top)}px)`;
  };

  return {
    setTool(next) {
      tool = next;
      render();
    },
    setEnabled(next) {
      enabled = next;
      if (!next) pinned = null;
      render();
    },
    hover(clientX, clientY) {
      pointer = { x: clientX, y: clientY };
      render();
    },
    leave() {
      pointer = null;
      render();
    },
    pointerAt() {
      return pointer;
    },
    pin(clientX, clientY) {
      pinned = { x: clientX, y: clientY };
      render();
    },
    unpin() {
      pinned = null;
      render();
    },
    preview(color) {
      if (color === previewColor) return;
      previewColor = color;
      render();
    },
    flash() {
      flashing = true;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flashing = false;
        render();
      }, FLASH_MS);
      render();
    },
    destroy() {
      clearTimeout(flashTimer);
      ring.remove();
      label.remove();
    },
  };
}
