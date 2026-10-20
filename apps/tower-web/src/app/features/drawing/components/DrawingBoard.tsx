import { createRenderer, type StrokeModel } from '@pictiotheme/canvas-engine';
import type { ShapePreview } from '@pictiotheme/doodle-shape';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@pictiotheme/protocol';
import type { TowerDrawOp } from '@pictiotheme/protocol/tower';
import { useEffect, useRef, useState } from 'react';
import type { ClosedShape } from '../closed-shape';
import { attachDrawingInput, nextOpId } from '../input';
import { FILL_COLORS, FILL_TOLERANCE, type DrawSettings } from '../tools';

/** How long the swatch stays up when it isn't used. */
const SWATCH_MS = 6000;

/**
 * Paper on a clipboard. The drawing canvas, with the live piece overlay under the ink:
 * what will be solid in orange, ink too far from the piece to be part of it hatched in grey.
 * `onOp` gets each stroke operation the player draws (by default it's applied to the model);
 * `plain` drops the clipboard, for small watch-only views like the spy window.
 *
 * Closing a shape pops a swatch of colours over it: a tap colours it in. Drawing on, undoing,
 * Escape or a few seconds' wait puts it away.
 */
export function DrawingBoard({
  model,
  settings,
  preview = null,
  showSilhouette = false,
  disabled = false,
  onOp,
  plain = false,
  label = 'Drawing canvas',
}: {
  model: StrokeModel;
  settings: DrawSettings;
  preview?: ShapePreview | null;
  showSilhouette?: boolean;
  disabled?: boolean;
  onOp?: (op: TowerDrawOp) => void;
  plain?: boolean;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const disabledRef = useRef(disabled);
  const onOpRef = useRef(onOp);
  // The bucket was tapped outside a closed shape: say why nothing happened, for a moment.
  const [refused, setRefused] = useState(0);
  useEffect(() => {
    if (!refused) return;
    const timer = setTimeout(() => setRefused(0), 1600);
    return () => clearTimeout(timer);
  }, [refused]);
  // The shape the last stroke closed, while its swatch is up.
  const [offer, setOffer] = useState<ClosedShape | null>(null);
  useEffect(() => {
    if (!offer) return;
    const timer = setTimeout(() => setOffer(null), SWATCH_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [offer]);
  // Any change to the drawing (the next stroke, undo, a fill) makes the offer stale.
  useEffect(() => model.subscribe(() => setOffer(null)), [model]);
  useEffect(() => {
    settingsRef.current = settings;
    disabledRef.current = disabled;
    onOpRef.current = onOp;
  });

  const colourIn = (shape: ClosedShape, color: string) => {
    const { x, y } = shape.seed;
    const op: TowerDrawOp = {
      t: 'draw:fill',
      id: nextOpId(),
      x,
      y,
      color,
      tolerance: FILL_TOLERANCE,
    };
    if (onOp) onOp(op);
    else model.apply(op);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stopRenderer = createRenderer(canvas, model, undefined, undefined, {
      enclosedFills: true,
    });
    const stopInput = attachDrawingInput(canvas, {
      emit: (op) => (onOpRef.current ? onOpRef.current(op) : model.apply(op)),
      getSettings: () => settingsRef.current,
      isEnabled: () => !disabledRef.current,
      onFillRefused: () => setRefused(Date.now()),
      onShapeClosed: setOffer,
    });
    return () => {
      stopInput();
      stopRenderer();
    };
  }, [model]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;
    overlay.width = CANVAS_WIDTH;
    overlay.height = CANVAS_HEIGHT;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!preview || !showSilhouette) return;
    const { frame, cols, cells, silhouette } = preview;
    ctx.fillStyle = 'oklch(0.6 0.03 250 / 0.28)';
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== 2) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      ctx.fillRect(frame.x0 + x * frame.cell, frame.y0 + y * frame.cell, frame.cell, frame.cell);
    }
    if (silhouette.length >= 6) {
      const path = new Path2D();
      path.moveTo(silhouette[0] as number, silhouette[1] as number);
      for (let i = 2; i + 1 < silhouette.length; i += 2) {
        path.lineTo(silhouette[i] as number, silhouette[i + 1] as number);
      }
      path.closePath();
      ctx.fillStyle = 'oklch(0.75 0.17 50 / 0.2)';
      ctx.fill(path);
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'oklch(0.66 0.18 45 / 0.85)';
      ctx.stroke(path);
    }
  }, [preview, showSilhouette]);

  return (
    <div
      className={
        plain
          ? 'relative'
          : 'relative rounded-3xl border-4 border-white bg-card-dark p-3 pt-6 shadow-panel'
      }
    >
      {/* The clipboard's clip. */}
      {!plain && (
        <div
          aria-hidden="true"
          className="absolute -top-2 left-1/2 h-6 w-28 -translate-x-1/2 rounded-xl bg-coral shadow-md"
        />
      )}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-paper shadow-inner"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.75 0.05 240 / 0.18) 1px, transparent 1px), linear-gradient(90deg, oklch(0.75 0.05 240 / 0.18) 1px, transparent 1px)',
          backgroundSize: '5% 6.667%',
        }}
      >
        <canvas ref={overlayRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
        <canvas
          ref={canvasRef}
          aria-label={label}
          className={`absolute inset-0 h-full w-full touch-none ${disabled ? 'cursor-default' : settings.tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair'}`}
        />
        {offer && !disabled && (
          <div
            role="group"
            aria-label="Colour in this shape"
            className="animate-swatch-pop absolute flex -translate-x-1/2 -translate-y-1/2 gap-1.5 rounded-full border-2 border-white bg-card-light/95 p-1.5 shadow-lg"
            style={{
              // Over the shape, but kept inside the board.
              left: `clamp(150px, ${(offer.centre.x / CANVAS_WIDTH) * 100}%, calc(100% - 150px))`,
              top: `clamp(32px, ${(offer.centre.y / CANVAS_HEIGHT) * 100}%, calc(100% - 32px))`,
            }}
          >
            {FILL_COLORS.map(({ name, hex }) => (
              <button
                key={hex}
                type="button"
                aria-label={`Fill with ${name}`}
                title={name}
                // Keep focus off it, so Space still reaches the tower.
                onMouseUp={(e) => e.currentTarget.blur()}
                onClick={() => colourIn(offer, hex)}
                className="size-7 rounded-full border-2 border-ink/20 transition hover:scale-115 pointer-coarse:size-10"
                style={{ background: hex }}
              />
            ))}
          </div>
        )}
        {refused > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
          >
            <span className="rounded-xl bg-ink/85 px-3 py-1.5 text-sm font-semibold text-cloud shadow-lg">
              The bucket only fills closed shapes
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
