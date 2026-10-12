import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { drawAndSend, strokeModel, type DrawOp, type StrokeModel } from '../../../realtime';
import { useColorSlots } from '../color-slots';
import type { AdjustPatch } from '../engine/adjust';
import { createBrushCursor, type BrushCursor } from '../engine/brush-cursor';
import { attachDrawingInput } from '../engine/input';
import { createRenderer } from '../engine/renderer';
import type { ToolSettings } from '../tools';
import type { ColorPopoverState, ToggleColorPopover } from '../use-color-popover';
import { ColorPopover } from './ColorPopover';

type Props = {
  canDraw: boolean;
  tool: ToolSettings;
  /** Size, opacity or tolerance changed by dragging on the canvas. */
  onToolChange: (patch: AdjustPatch) => void;
  /** A colour was picked: eyedropper, popover swatch, or the custom picker closing. */
  onPickColor: (color: string) => void;
  /** The custom picker is being dragged: preview without committing. */
  onLiveColor: (color: string) => void;
  /** The toolbar's dropper is armed: the next press on the canvas picks up a colour. */
  picking?: boolean;
  /** The colour popover (`C`, a middle-click, a long-press or the toolbar's wheel). */
  colorPopover: ColorPopoverState | null;
  onToggleColorPopover: ToggleColorPopover;
  onCloseColorPopover: () => void;
  /** Overlays (choosing, reveal, paused) shown on top of the canvas. */
  children?: ReactNode;
  /** On the room's sheet of paper: no frame of its own, so it blends into the players' margin. */
  bare?: boolean;
  /**
   * Drawing somewhere other than the room (a deck cover): its own stroke model and logical
   * size, local `emit`, frame size and canvas label. Defaults are the room's 4:3 board.
   */
  pad?: {
    model: StrokeModel;
    emit: (op: DrawOp) => void;
    size: { width: number; height: number };
    frameClassName: string;
    label: string;
    canvasRef?: RefObject<HTMLCanvasElement | null>;
  };
};

/** The drawing surface. Strokes never pass through React (rule W9). */
export function DrawingBoard({
  canDraw,
  tool,
  onToolChange,
  onPickColor,
  onLiveColor,
  colorPopover,
  onToggleColorPopover,
  onCloseColorPopover,
  children,
  pad,
  picking = false,
  bare = false,
}: Props) {
  const ownCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = pad?.canvasRef ?? ownCanvasRef;
  const padRef = useRef(pad);
  const cursorLayerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<BrushCursor | null>(null);
  const toolRef = useRef(tool);
  const canDrawRef = useRef(canDraw);
  const onToolChangeRef = useRef(onToolChange);
  const onPickColorRef = useRef(onPickColor);
  const pickingRef = useRef(picking);
  const onToggleColorPopoverRef = useRef(onToggleColorPopover);
  useEffect(() => {
    onToggleColorPopoverRef.current = onToggleColorPopover;
    pickingRef.current = picking;
    toolRef.current = tool;
    canDrawRef.current = canDraw;
    onToolChangeRef.current = onToolChange;
    onPickColorRef.current = onPickColor;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = cursorLayerRef.current;
    if (!canvas || !layer) return;
    // The pad is fixed for the board's lifetime: mount a new board to draw something else.
    const target = padRef.current;
    const stopRenderer = createRenderer(canvas, target?.model ?? strokeModel, target?.size);
    const cursor = createBrushCursor(canvas, layer);
    cursor.setTool(toolRef.current);
    cursor.setEnabled(canDrawRef.current);
    cursorRef.current = cursor;
    const stopInput = attachDrawingInput(canvas, {
      emit: target?.emit ?? drawAndSend,
      getTool: () => toolRef.current,
      setTool: (patch) => onToolChangeRef.current(patch),
      pickColor: (color) => onPickColorRef.current(color),
      isEnabled: () => canDrawRef.current,
      isPicking: () => pickingRef.current,
      toggleColors: (opening) => onToggleColorPopoverRef.current(opening),
      cursor,
    });
    return () => {
      stopInput();
      cursor.destroy();
      cursorRef.current = null;
      stopRenderer();
    };
  }, [canvasRef]);

  useEffect(() => cursorRef.current?.setTool(tool), [tool]);
  useEffect(() => cursorRef.current?.setEnabled(canDraw), [canDraw]);

  // Show the real size whenever a setting changes, however it was changed, and the hex code
  // when it was the colour.
  const settingsKey = `${tool.tool}|${tool.color}|${tool.size}|${tool.opacity}|${tool.fillTolerance}`;
  const shownKey = useRef(settingsKey);
  const shownColor = useRef(tool.color);
  useEffect(() => {
    if (shownKey.current === settingsKey) return;
    shownKey.current = settingsKey;
    const colorChanged = shownColor.current !== tool.color && tool.tool !== 'eraser';
    shownColor.current = tool.color;
    cursorRef.current?.flash(colorChanged ? tool.color : undefined);
  }, [settingsKey, tool.color, tool.tool]);

  // Saving a colour slot (Shift+digit, right-click or long-press on it) says so on the ring.
  const slots = useColorSlots((s) => s.slots);
  const shownSlots = useRef(slots);
  useEffect(() => {
    const before = shownSlots.current;
    shownSlots.current = slots;
    const saved = slots.findIndex((c, i) => c !== before[i]);
    if (saved >= 0) cursorRef.current?.flash(`Saved to ${saved + 1}`);
  }, [slots]);

  return (
    <div
      className={`relative ${pad?.frameClassName ?? 'aspect-[4/3] w-full'} overflow-hidden bg-white select-none [-webkit-touch-callout:none] ${bare ? '' : 'rounded-xl border border-zinc-300 shadow-sm dark:border-zinc-700'}`}
    >
      <canvas
        ref={canvasRef}
        aria-label={
          pad?.label ?? (canDraw ? 'Drawing canvas: draw your word here' : 'The current drawing')
        }
        className={`block h-full w-full touch-none ${canDraw ? (picking ? 'cursor-copy' : tool.tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair') : ''}`}
      />
      <div ref={cursorLayerRef} className="pointer-events-none absolute inset-0" />
      {children}
      {canDraw && colorPopover && (
        <ColorPopover
          tool={tool}
          anchor={() => colorPopover.at ?? cursorRef.current?.pointerAt() ?? null}
          hold={colorPopover.hold}
          onLive={onLiveColor}
          onPick={(color) => {
            onPickColor(color);
            onCloseColorPopover();
          }}
          onClose={onCloseColorPopover}
        />
      )}
    </div>
  );
}
