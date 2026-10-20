import type { Piece } from '@pictiotheme/doodle-shape';
import { LINE_HEIGHTS, type Team, type TowerPiece } from '@pictiotheme/protocol/tower';
import { DEFAULT_TUNING, type BodyState } from '@pictiotheme/tower-physics';
import { useEffect, useRef } from 'react';
import { serverNow, towerFrames, useRoomStore } from '../../../realtime';
import { renderPieceBitmap } from '../../piece';
import { playVillageCue } from '../../sound';
import { easeCamera, targetCamera, type Camera } from '../camera';
import { createTowerLife, updateTowerLife } from '../fallout';
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
 * the moment they press a key instead of a round trip later. Its village lives here too (this
 * player's own: pieces that fall land in it), and its sounds play at `volume`, panned by where
 * along the lane they happen, whether or not the ground is in view.
 */
export function LiveTower({
  team,
  insetTop = 30,
  insetBottom = 0,
  fit = 'platform',
  predict,
  volume = 1,
}: {
  team: Team;
  insetTop?: number;
  insetBottom?: number;
  fit?: 'reach' | 'platform';
  predict?: () => { x: number; angle: number } | null;
  /** How loud this tower's village is (the other crew's is quieter). */
  volume?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const predictRef = useRef(predict);
  const volumeRef = useRef(volume);
  useEffect(() => {
    predictRef.current = predict;
    volumeRef.current = volume;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const looks = new Map<number, PieceLook>();
    const seed = team === 'orange' ? 1 : 2;
    const life = createTowerLife(seed * 7 + 1, platformWidth);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
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
      for (const cue of updateTowerLife(life, bodies, looks, dt, still.matches)) {
        const half = size.width / 2 / camera.ppu;
        playVillageCue(cue, {
          volume: volumeRef.current,
          pan: ((cue.x - camera.centerX) / half) * 0.6,
        });
      }
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
        time: now / 1000,
        seed,
        life,
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
