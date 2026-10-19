import type { Piece } from '@pictiotheme/doodle-shape';
import { useEffect, useRef } from 'react';

const LIMITED_BY: Record<Piece['limitedBy'], string> = {
  area: 'Normal size',
  length: 'Capped: too long',
  thickness: 'Grown: too thin',
};

/**
 * The piece the drawing would make right now, at its real size next to a ruler of the platform's
 * width, with its convex parts (what the physics sees) outlined.
 */
export function PiecePreview({
  piece,
  platformWidth,
}: {
  piece: Piece | null;
  platformWidth: number;
}) {
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

    // The ruler: the platform's width across the card.
    const ppu = (w - 24) / platformWidth;
    const rulerY = h - 14;
    ctx.strokeStyle = 'oklch(0.3 0.03 260 / 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, rulerY);
    ctx.lineTo(w - 12, rulerY);
    for (let i = 0; i <= platformWidth; i++) {
      const x = 12 + i * ppu;
      ctx.moveTo(x, rulerY);
      ctx.lineTo(x, rulerY - (i % 5 === 0 ? 8 : 4));
    }
    ctx.stroke();
    if (!piece) return;

    ctx.save();
    ctx.translate(w / 2, (rulerY - 6) / 2 + 2);
    ctx.scale(ppu, -ppu);
    const trace = (flat: readonly number[]) => {
      ctx.beginPath();
      ctx.moveTo(flat[0] as number, flat[1] as number);
      for (let i = 2; i + 1 < flat.length; i += 2)
        ctx.lineTo(flat[i] as number, flat[i + 1] as number);
      ctx.closePath();
    };
    trace(piece.outline);
    ctx.fillStyle = 'oklch(0.75 0.17 50)';
    ctx.fill();
    ctx.lineWidth = 1.5 / ppu;
    ctx.strokeStyle = 'oklch(0.25 0.03 260 / 0.55)';
    for (const part of piece.parts) {
      trace(part);
      ctx.stroke();
    }
    ctx.restore();
  }, [piece, platformWidth]);

  return (
    <figure className="rounded-md bg-ply-light/70 p-2">
      <canvas ref={ref} aria-hidden="true" className="h-28 w-full" />
      <figcaption className="mt-1 flex flex-wrap justify-between gap-x-3 px-1 text-xs text-ink/75">
        {piece ? (
          <>
            <span>{LIMITED_BY[piece.limitedBy]}</span>
            <span>
              {piece.outline.length / 2} corners · {piece.parts.length}{' '}
              {piece.parts.length === 1 ? 'part' : 'parts'}
            </span>
          </>
        ) : (
          <span>Draw something to see its block</span>
        )}
      </figcaption>
    </figure>
  );
}
