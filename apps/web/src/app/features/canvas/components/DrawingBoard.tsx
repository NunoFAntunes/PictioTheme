import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { drawAndSend, strokeModel, type DrawOp, type StrokeModel } from '../../../realtime';
import type { AdjustPatch } from '../engine/adjust';
import { createBrushCursor, type BrushCursor } from '../engine/brush-cursor';
import { attachDrawingInput } from '../engine/input';
import { createRenderer } from '../engine/renderer';
import type { ToolSettings } from '../tools';
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
  /** The toolbar's 💧 is armed: the next press on the canvas picks up a colour. */
  picking?: boolean;
  /** The `C` colour popover. */
  colorPopoverOpen: boolean;
  onCloseColorPopover: () => void;
  /** Overlays (choosing, reveal, paused) shown on top of the canvas. */
  children?: ReactNode;
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
  colorPopoverOpen,
  onCloseColorPopover,
  children,
  pad,
  picking = false,
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
  useEffect(() => {
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

  // Show the real size whenever a setting changes, however it was changed.
  const settingsKey = `${tool.tool}|${tool.color}|${tool.size}|${tool.opacity}|${tool.fillTolerance}`;
  const shownKey = useRef(settingsKey);
  useEffect(() => {
    if (shownKey.current === settingsKey) return;
    shownKey.current = settingsKey;
    cursorRef.current?.flash();
  }, [settingsKey]);

  return (
    <div
      className={`relative ${pad?.frameClassName ?? 'aspect-[4/3] w-full'} overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm select-none [-webkit-touch-callout:none] dark:border-zinc-700`}
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
      {canDraw && colorPopoverOpen && (
        <ColorPopover
          tool={tool}
          anchor={() => cursorRef.current?.pointerAt() ?? null}
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
