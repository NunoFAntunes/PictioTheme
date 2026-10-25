import type { Stroke } from '@pictiotheme/protocol';
import { useEffect, useRef } from 'react';
import { doodle } from '../loops/paint';

/** A drawing's strokes, as the drawer drew them, fitted into the canvas. */
export function Doodle({ strokes, className }: { strokes: readonly Stroke[]; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    doodle(ctx, strokes, { x: 0, y: 0, w, h }, 1);
  }, [strokes]);
  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
