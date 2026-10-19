import { createRenderer, type StrokeModel } from '@pictiotheme/canvas-engine';
import type { ShapePreview } from '@pictiotheme/doodle-shape';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@pictiotheme/protocol';
import { useEffect, useRef } from 'react';
import { attachDrawingInput } from '../input';
import type { DrawSettings } from '../tools';

/**
 * Tracing paper on a clipboard. The drawing canvas, with the live piece overlay under the ink:
 * what will be solid in orange, ink too far from the piece to be part of it hatched in grey.
 */
export function DrawingBoard({
  model,
  settings,
  preview,
  showSilhouette,
  disabled = false,
}: {
  model: StrokeModel;
  settings: DrawSettings;
  preview: ShapePreview | null;
  showSilhouette: boolean;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    settingsRef.current = settings;
    disabledRef.current = disabled;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stopRenderer = createRenderer(canvas, model);
    const stopInput = attachDrawingInput(canvas, {
      model,
      getSettings: () => settingsRef.current,
      isEnabled: () => !disabledRef.current,
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
    <div className="relative rounded-lg bg-ply-dark p-3 pt-6 shadow-panel">
      {/* The clipboard's clip. */}
      <div
        aria-hidden="true"
        className="absolute -top-2 left-1/2 h-6 w-28 -translate-x-1/2 rounded-md bg-gradient-to-b from-steel to-steel-dark shadow-md"
      />
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-tracing shadow-inner"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.75 0.05 240 / 0.18) 1px, transparent 1px), linear-gradient(90deg, oklch(0.75 0.05 240 / 0.18) 1px, transparent 1px)',
          backgroundSize: '5% 6.667%',
        }}
      >
        <canvas ref={overlayRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
        <canvas
          ref={canvasRef}
          aria-label="Drawing canvas"
          className={`absolute inset-0 h-full w-full touch-none ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
        />
      </div>
    </div>
  );
}
