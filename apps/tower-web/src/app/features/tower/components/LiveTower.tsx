import type { Piece } from '@pictiotheme/doodle-shape';
import { LINE_HEIGHTS, STAR_TUNING, type Team, type TowerPiece } from '@pictiotheme/protocol/tower';
import { DEFAULT_TUNING, isPigeonId, type BodyState } from '@pictiotheme/tower-physics';
import { useEffect, useRef } from 'react';
import { myTeam, serverNow, towerFrames, useRoomStore, type RoomView } from '../../../realtime';
import { renderPieceBitmap } from '../../piece';
import { uiScale } from '../../../lib/ui-scale';
import { playVillageCue } from '../../sound';
import {
  BIRD_FLY_MS,
  createMagpieFlight,
  createPigeonFlights,
  type MagpieInput,
} from '../../birds';
import { easeCamera, targetCamera, toScreen, type Camera } from '../camera';
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
  return { piece: shape, bitmap, curses: piece.sent ? piece.curses : [] };
}

/** Where the piece being placed hangs from its balloons, on the tower's canvas. */
export type PlacingAt = { x: number; y: number; ppu: number };

/** How long fog takes to roll in and out. */
const FOG_FADE_MS = 600;

/**
 * How thick a Fog spell on this tower is right now (0: none). Thick for the crew it was cast at,
 * thin for everyone else, so the caster's crew can still enjoy the view.
 */
function fogOn(view: RoomView, team: Team, now: number): number {
  const spell = view.crews[team].spell;
  if (spell?.spell !== 'fog' || now < spell.startsAt || now >= spell.endsAt) return 0;
  const ramp = Math.min(now - spell.startsAt, spell.endsAt - now, FOG_FADE_MS) / FOG_FADE_MS;
  return ramp * (myTeam(view) === team ? 0.97 : 0.45);
}

/** The sky star by this tower, and how far through its hold it is. */
function starOf(view: RoomView, team: Team, now: number) {
  const star = view.crews[team].star;
  if (!star) return null;
  const hold =
    star.holdUntil === null
      ? 0
      : Math.min(1, Math.max(0, 1 - (star.holdUntil - now) / STAR_TUNING.holdMs));
  return { x: star.x, y: star.y, radius: STAR_TUNING.radius, hold };
}

/** A pigeon missing from the frames this long has left (they're in every frame while here). */
const PIGEON_GONE_MS = 300;

/**
 * The magpies' comings and goings at this tower: one cast at it (flying in to take its top piece,
 * then off), the last piece one took from it, and the last one brought to it (arriving once it's
 * flown off the other tower). The other crew's tower is on `side`.
 */
function magpiesAt(view: RoomView, team: Team, now: number, top: MagpieInput['top'], side: 1 | -1) {
  const spell = view.crews[team].spell;
  const takesAt = spell?.spell === 'magpie' && now < spell.endsAt ? spell.startsAt : null;
  let took: MagpieInput['took'] = null;
  let brought: { at: number; pieceId: number } | null = null;
  for (const e of view.events) {
    if (e.kind !== 'magpied' || e.pieceId === undefined) continue;
    if (e.team === team) took = { at: e.at, pieceId: e.pieceId };
    else brought = { at: e.at + BIRD_FLY_MS, pieceId: e.pieceId };
  }
  return { now, takesAt, top, side, took, brought };
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
  onPlacing,
  onTop,
}: {
  team: Team;
  insetTop?: number;
  insetBottom?: number;
  fit?: 'reach' | 'platform';
  predict?: () => { x: number; angle: number } | null;
  /** How loud this tower's village is (the other crew's is quieter). */
  volume?: number;
  /**
   * Every frame: where the knot of the balloons over the piece being placed is, in CSS px from
   * the canvas's top left, with the view's px per world unit. Null while nothing's being placed.
   */
  onPlacing?: (at: PlacingAt | null) => void;
  /** Every frame: where the top of the tower is (the platform's middle while it's empty). */
  onTop?: (at: PlacingAt) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const predictRef = useRef(predict);
  const volumeRef = useRef(volume);
  const onPlacingRef = useRef(onPlacing);
  const onTopRef = useRef(onTop);
  useEffect(() => {
    predictRef.current = predict;
    volumeRef.current = volume;
    onPlacingRef.current = onPlacing;
    onTopRef.current = onTop;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const looks = new Map<number, PieceLook>();
    const pigeonFlights = createPigeonFlights();
    const magpieFlight = createMagpieFlight();
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
      let topPiece: MagpieInput['top'] = null;
      const spell = crew.spell;
      const perched =
        spell?.spell === 'pigeon' && serverNow() >= spell.startsAt && serverNow() < spell.endsAt;
      const perches: { id: number; x: number; y: number }[] = [];
      const frames = towerFrames[team];
      for (const pose of frames.poses(now)) {
        if (isPigeonId(pose.id)) {
          const fresh = now - (frames.lastSeen(pose.id) ?? -Infinity) < PIGEON_GONE_MS;
          if (perched && fresh) perches.push({ id: pose.id, x: pose.x, y: pose.y });
          continue;
        }
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
        if (!active) {
          const top = worldExtent(body, look.piece.outline).top;
          if (!topPiece || top > towerTop) topPiece = { x: body.x, y: body.y, angle: body.angle };
          towerTop = Math.max(towerTop, top);
        }
      }

      const pigeons = pigeonFlights(perches, now);
      // Your own tower is on the left, the other crew's on the right.
      const side = team === (myTeam(view) ?? 'orange') ? 1 : -1;
      const magpies = magpiesAt(view, team, serverNow(), topPiece, side);
      const delivering = magpies.brought;
      const placed = delivering && bodies.find((b) => b.id === delivering.pieceId && b.active);
      const { birds, hide } = magpieFlight({
        ...magpies,
        brought: delivering && { ...delivering, to: placed ? { x: placed.x, y: placed.y } : null },
      });
      // A piece it carries is drawn from its look, like any other.
      for (const bird of birds) {
        const piece = bird.carrying === undefined ? undefined : view.pieces[bird.carrying];
        if (piece && !looks.has(piece.id)) looks.set(piece.id, lookOf(piece));
      }

      const line = LINE_HEIGHTS[view.settings.line];
      // The header over the view is sized like the rest of the interface.
      const u = uiScale();
      camera = easeCamera(
        camera,
        targetCamera({
          ...size,
          platformWidth,
          reach,
          towerTop,
          line,
          insetTop: insetTop * u,
          insetBottom: insetBottom * u,
          fit,
        }),
        dt,
      );
      for (const cue of updateTowerLife(life, bodies, looks, dt, still.matches)) {
        const half = size.width / 2 / camera.ppu;
        playVillageCue(cue, {
          volume: volumeRef.current,
          pan: ((cue.x - camera.centerX) / half) * 0.6,
        });
      }
      onTopRef.current?.({ ...toScreen(camera, size, 0, towerTop), ppu: camera.ppu });
      const placing = bodies.find((b) => b.active && b.id !== hide);
      const placingLook = placing && looks.get(placing.id);
      onPlacingRef.current?.(
        placing && placingLook
          ? {
              ...toScreen(
                camera,
                size,
                placing.x,
                worldExtent(placing, placingLook.piece.outline).top,
              ),
              ppu: camera.ppu,
            }
          : null,
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
        insetTop: insetTop * u,
        showColliders: false,
        time: now / 1000,
        seed,
        life,
        fog: fogOn(view, team, serverNow()),
        star: starOf(view, team, serverNow()),
        birds: [...pigeons, ...birds],
        hide,
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
