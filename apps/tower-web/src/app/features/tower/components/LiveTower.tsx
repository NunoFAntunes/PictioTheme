import type { Piece } from '@pictiotheme/doodle-shape';
import { LINE_HEIGHTS, type Team, type TowerPiece } from '@pictiotheme/protocol/tower';
import { DEFAULT_TUNING, type BodyState } from '@pictiotheme/tower-physics';
import { useEffect, useRef } from 'react';
import { serverNow, towerFrames, useRoomStore } from '../../../realtime';
import { renderPieceBitmap } from '../../piece';
import { easeCamera, targetCamera, type Camera } from '../camera';
import { drawTower, worldExtent, type PieceLook } from '../renderer';

/** The server's worlds use the default tuning (docs/tower/technical/physics.md). */
const { platformWidth, platformThickness, reach } = DEFAULT_TUNING;

/** The look of a piece from the room view: its doodle, cut out. Built once per piece. */
function lookOf(piece: TowerPiece): PieceLook {
  const { silhouette, cell, ...geometry } = piece.shape;
  const shape: Piece = geometry;
  const bitmap = renderPieceBitmap(piece.strokes, shape, {
    frame: { x0: 0, y0: 0, cell },
    cols: 0,
    rows: 0,
    cells: new Uint8Array(),
    silhouette,
  });
  return { piece: shape, bitmap };
}

/**
 * One crew's tower, live: the server's frames, interpolated, drawn on every animation frame
 * outside React. For the placer, `predict` gives where they're steering the piece, so it moves
 * the moment they press a key instead of a round trip later.
 */
export function LiveTower({
  team,
  insetTop = 30,
  insetBottom = 0,
  fit = 'platform',
  predict,
}: {
  team: Team;
  insetTop?: number;
  insetBottom?: number;
  fit?: 'reach' | 'platform';
  predict?: () => { x: number; angle: number } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const predictRef = useRef(predict);
  useEffect(() => {
    predictRef.current = predict;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const looks = new Map<number, PieceLook>();
    let camera: Camera | null = null;
    let last = performance.now();
    let frame = 0;

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const view = useRoomStore.getState().view;
      if (!view) return;
      const dpr = window.devicePixelRatio || 1;
      const size = { width: canvas.clientWidth, height: canvas.clientHeight };
      if (!size.width || !size.height) return;
      if (canvas.width !== Math.round(size.width * dpr))
        canvas.width = Math.round(size.width * dpr);
      if (canvas.height !== Math.round(size.height * dpr))
        canvas.height = Math.round(size.height * dpr);

      const crew = view.crews[team];
      const activeId = crew.placing?.pieceId ?? null;
      const target = activeId !== null ? (predictRef.current?.() ?? null) : null;
      const bodies: BodyState[] = [];
      let towerTop = 0;
      for (const pose of towerFrames[team].poses(now)) {
        const piece = view.pieces[pose.id];
        if (!piece || piece.fumbled) continue;
        let look = looks.get(pose.id);
        if (!look) {
          look = lookOf(piece);
          looks.set(pose.id, look);
        }
        const active = pose.id === activeId;
        const body: BodyState = {
          ...pose,
          ...(active && target && { x: target.x, angle: target.angle }),
          active,
          settled: false,
        };
        bodies.push(body);
        if (!active) towerTop = Math.max(towerTop, worldExtent(body, look.piece.outline).top);
      }

      const line = LINE_HEIGHTS[view.settings.line];
      camera = easeCamera(
        camera,
        targetCamera({ ...size, platformWidth, reach, towerTop, line, insetTop, insetBottom, fit }),
        dt,
      );
      const topping =
        crew.toppingUntil === null
          ? null
          : Math.min(1, 1 - (crew.toppingUntil - serverNow()) / 3000);
      drawTower(ctx, size, dpr, camera, {
        bodies,
        looks,
        platformWidth,
        platformThickness,
        line,
        height: crew.height,
        topping,
        insetTop,
        showColliders: false,
      });
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [team, insetTop, insetBottom, fit]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={`${team === 'orange' ? 'Orange' : 'Teal'} crew's tower`}
      className="absolute inset-0 h-full w-full"
    />
  );
}
