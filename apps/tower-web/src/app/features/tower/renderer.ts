import { PIGEON, type BodyState, type PieceId } from '@pictiotheme/tower-physics';
import {
  displayFont,
  drawBalloon,
  drawBird,
  drawCloud,
  drawCrumbs,
  drawHills,
  drawProp,
  drawVillageProps,
  drawVillagers,
  MEADOW,
  PROPS,
  seeded,
  wrap,
  type VillageView,
} from '../scenery';
import { CARRY_BELOW, type Bird } from './birds';
import { GROUND, LANE, toScreen, type Camera } from './camera';
import { drawFallout, type TowerLife } from './fallout';
import { paintPiece, type PieceLook } from './piece-look';

export type { PieceLook };

/**
 * Draws one tower with Canvas 2D (docs/tower/technical/architecture.md#frontend) in the sunny
 * meadow (docs/tower/design/visual-identity.md): a sky that deepens with height, clouds the tower
 * climbs past, hills, the village at its foot and its villagers (`fallout.ts`: busy, and in the
 * way of pieces falling off), the grassy stone plinth, a height ruler, the topping-out bunting,
 * the pieces as paper cut-outs, and the bunch of balloons carrying the piece being placed. Plain
 * TypeScript, called once per animation frame.
 */

export type TowerScene = {
  bodies: readonly BodyState[];
  looks: ReadonlyMap<PieceId, PieceLook>;
  platformWidth: number;
  platformThickness: number;
  line: number;
  /** The measured height of the tower. */
  height: number;
  /** 0–1 while the tower is above the line and counting down to topping out. */
  topping: number | null;
  /** CSS px covered by the HUD bar at the top. */
  insetTop: number;
  showColliders: boolean;
  /** Seconds, for everything that moves on its own (clouds, birds, balloons). */
  time: number;
  /** Picks this tower's own scenery (which houses and trees where). */
  seed: number;
  /** The village at its foot and the pieces that fell into it. */
  life: TowerLife;
  /**
   * 0–1: a Fog spell over the top of the tower (docs/tower/planning/power-ups.md). Only the piece
   * being placed and its guide show through.
   */
  fog?: number;
  /** A sky star by the tower; `hold` 0–1 while a piece is touching it (it's caught at 1). */
  star?: { x: number; y: number; radius: number; hold: number } | null;
  /** The spells' birds: a pigeon on the tower, magpies over it (`birds.ts`). */
  birds?: readonly Bird[];
  /** A piece not to draw yet: a magpie is still flying it in. */
  hide?: PieceId | null;
};

/** The spells' birds: one drawing, two plumages. */
const PLUMAGE = {
  // Grey, with a green-and-purple neck.
  pigeon: {
    body: 'oklch(0.72 0.02 260)',
    wing: 'oklch(0.6 0.03 260)',
    neck: 'oklch(0.55 0.1 175)',
    head: 'oklch(0.72 0.02 260)',
    belly: null,
    edge: 'oklch(0.3 0.03 260)',
    beak: 'oklch(0.75 0.12 60)',
    eye: 'oklch(0.55 0.18 40)',
    legs: 'oklch(0.7 0.14 15)',
    tail: 1,
  },
  // Black and white, with a blue sheen on the wing and a long tail.
  magpie: {
    body: 'oklch(0.22 0.01 260)',
    wing: 'oklch(0.36 0.09 255)',
    neck: 'oklch(0.22 0.01 260)',
    head: 'oklch(0.22 0.01 260)',
    belly: 'oklch(0.97 0.005 260)',
    edge: 'oklch(0.12 0.01 260)',
    beak: 'oklch(0.3 0.01 260)',
    eye: 'oklch(0.85 0.02 260)',
    legs: 'oklch(0.3 0.01 260)',
    tail: 1.9,
  },
} as const;
type Plumage = (typeof PLUMAGE)[keyof typeof PLUMAGE];

const COLORS = {
  star: 'oklch(0.88 0.17 92)',
  starEdge: 'oklch(0.99 0.03 95)',
  starGlow: 'oklch(0.9 0.18 92 / 0.9)',
  frost: 'oklch(0.9 0.07 225 / 0.42)',
  frostEdge: 'oklch(0.97 0.03 225 / 0.95)',
  ruler: 'oklch(1 0 0 / 0.9)',
  rulerInk: 'oklch(0.3 0.08 265 / 0.55)',
  label: 'oklch(0.28 0.09 270)',
  rope: 'oklch(1 0 0 / 0.95)',
  pennants: [
    'oklch(0.68 0.22 25)',
    'oklch(0.86 0.17 92)',
    'oklch(0.7 0.16 230)',
    'oklch(0.78 0.18 145)',
    'oklch(0.72 0.2 330)',
  ],
  gold: 'oklch(0.86 0.17 92)',
  marker: 'oklch(0.72 0.19 40)',
  guide: 'oklch(1 0 0 / 0.14)',
  guideEdge: 'oklch(1 0 0 / 0.55)',
  shadow: 'oklch(0.3 0.1 265 / 0.35)',
  string: 'oklch(0.35 0.03 265 / 0.75)',
  collider: [
    '#ff4fd8',
    '#3df5ff',
    '#b6ff3d',
    '#ffd23d',
    '#ff7a3d',
    '#9b7bff',
    '#3dff9e',
    '#ff3d6e',
  ],
};

/** Text in white with a soft dark outline, readable on any sky. */
function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.rulerInk;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = COLORS.ruler;
  ctx.fillText(text, x, y);
}

/** Highest and lowest points and horizontal extent of a body's outline, in world units. */
export function worldExtent(body: BodyState, outline: readonly number[]) {
  const sin = Math.sin(body.angle);
  const cos = Math.cos(body.angle);
  let top = -Infinity;
  let bottom = Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (let i = 0; i + 1 < outline.length; i += 2) {
    const lx = outline[i] as number;
    const ly = outline[i + 1] as number;
    const x = body.x + cos * lx - sin * ly;
    const y = body.y + sin * lx + cos * ly;
    top = Math.max(top, y);
    bottom = Math.min(bottom, y);
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  return { top, bottom, left, right };
}

// ── This tower's scenery, built once per seed ──

type Decor = { sprite: string; x: number; height: number; flip: boolean };
type SkyCloud = { sprite: string; alt: number; start: number; speed: number; width: number };
type Scenery = { far: Decor[]; near: Decor[]; clouds: SkyCloud[] };

/** How far out the village goes on each side, for the widest views. */
const VILLAGE_REACH = 20;
/** Where the far row of cottages stands, up on the hill behind (world units). */
const FAR_ROW = GROUND + 1;

const sceneries = new Map<string, Scenery>();

function sceneryFor(seed: number, halfW: number): Scenery {
  const key = `${seed}:${halfW}`;
  let scenery = sceneries.get(key);
  if (scenery) return scenery;
  const rnd = seeded(seed);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)] as T;
  const big = ['house1', 'house2'] as const;
  const small = ['houseSmall1', 'houseSmall2'] as const;
  // The far row: little cottages and trees along the hill, a gap left behind the plinth.
  const far: Decor[] = [];
  for (const side of [-1, 1]) {
    for (let x = 0.8 + rnd() * 0.6; x < VILLAGE_REACH; x += 1.3 + rnd() * 1.1) {
      far.push(
        rnd() < 0.55
          ? { sprite: pick(small), x: side * x, height: 0.95 + rnd() * 0.25, flip: rnd() < 0.5 }
          : { sprite: pick(PROPS.tree), x: side * x, height: 1.4 + rnd() * 0.4, flip: false },
      );
    }
  }
  // The near row: houses with trees and fences between them, clear of the plinth's cap.
  const near: Decor[] = [];
  for (const side of [-1, 1]) {
    near.push({
      sprite: pick(PROPS.sapling),
      x: side * (halfW * 0.62 + 0.3),
      height: 1.1,
      flip: false,
    });
    let x = halfW + 0.3;
    let lastHouse = false;
    while (x < VILLAGE_REACH) {
      const roll = rnd();
      const house: boolean = !lastHouse && roll < 0.55;
      let sprite: string;
      let height: number;
      let width: number;
      if (house) [sprite, height, width] = [pick(big), 2.1 + rnd() * 0.4, 2.4];
      else if (roll < 0.8) [sprite, height, width] = [pick(PROPS.tree), 2.6 + rnd() * 0.8, 1.3];
      else [sprite, height, width] = ['fence', 0.7, 1.1];
      near.push({ sprite, height, x: side * (x + width / 2), flip: house && side > 0 });
      lastHouse = house;
      x += width + 0.1 + rnd() * 0.4;
    }
    near.push({
      sprite: pick(PROPS.bush),
      x: side * (halfW * 0.62 + 0.9 + rnd() * 0.4),
      height: 0.65,
      flip: rnd() < 0.5,
    });
  }
  // Clouds every few metres up, so a growing tower keeps passing them.
  const clouds: SkyCloud[] = [];
  for (let alt = 3 + rnd() * 1.5; alt < 60; alt += 2.6 + rnd() * 2.4) {
    const n = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      clouds.push({
        sprite: pick(PROPS.cloud),
        alt: alt + (rnd() - 0.5) * 1.2,
        start: rnd(),
        speed: (0.15 + rnd() * 0.35) * (rnd() < 0.5 ? -1 : 1),
        width: 2.4 + rnd() * 2.2,
      });
    }
  }
  scenery = { far, near, clouds };
  sceneries.set(key, scenery);
  return scenery;
}

/** The sky by height: the hazy horizon, bright blue, then deeper blue above the clouds. */
function skyGradient(
  ctx: CanvasRenderingContext2D,
  S: (x: number, y: number) => { x: number; y: number },
) {
  const g = ctx.createLinearGradient(0, S(0, 0).y, 0, S(0, 40).y);
  g.addColorStop(0, MEADOW.skyHorizon);
  g.addColorStop(0.3, MEADOW.skyTop);
  g.addColorStop(1, MEADOW.skyHigh);
  return g;
}

export function drawTower(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  dpr: number,
  camera: Camera,
  scene: TowerScene,
): void {
  const { width, height } = size;
  const { ppu } = camera;
  const t = scene.time;
  const S = (x: number, y: number) => toScreen(camera, size, x, y);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const viewTop = camera.bottom + height / ppu;
  const halfW = scene.platformWidth / 2;
  const viewHalf = width / 2 / ppu;
  const scenery = sceneryFor(scene.seed, halfW);
  const cheering = scene.topping !== null;
  const groundY = S(0, GROUND).y;
  const groundInView = groundY < height + 4 * ppu;

  // ── Sky ──
  ctx.fillStyle = skyGradient(ctx, S);
  ctx.fillRect(0, 0, width, height);

  // ── Clouds drifting past, behind the tower ──
  for (const c of scenery.clouds) {
    if (c.alt < camera.bottom - 2 || c.alt > viewTop + 2) continue;
    const span = 2 * viewHalf + 2 * c.width;
    const x = wrap(c.start * span + c.speed * t, span) - span / 2;
    const at = S(x, c.alt);
    drawCloud(ctx, c.sprite, at.x, at.y, c.width * ppu, 0.92);
  }

  // ── A few birds crossing now and then ──
  const birdAlt = 5 + (scene.seed % 3) * 2.5;
  if (birdAlt > camera.bottom && birdAlt < viewTop) {
    const flight = wrap(t + scene.seed * 13, 36) / 36;
    const dir = scene.seed % 2 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const x = dir * (-viewHalf - 1 + flight * (2 * viewHalf + 4) - i * 0.7);
      const at = S(x, birdAlt + Math.sin(t * 0.9 + i) * 0.25 + (i % 2) * 0.4);
      drawBird(ctx, at.x, at.y, Math.max(8, 0.45 * ppu) - i * 1.5, t + i * 0.6);
    }
  }

  // ── Hills and what grows on them, behind the plinth ──
  if (groundInView) {
    // The far hills sink more slowly than the ground as the view rises.
    const rise = Math.max(0, (camera.bottom - GROUND) * ppu);
    const far = S(0, GROUND + 2.2).y - rise * 0.45;
    drawHills(ctx, width, far, height, 0.6 * ppu, 9 * ppu, MEADOW.hillFar, scene.seed + 3);
    // The far row of cottages, half hidden by the near hill.
    for (const d of scenery.far) {
      if (Math.abs(d.x) > viewHalf + 2) continue;
      const at = S(d.x, FAR_ROW);
      drawProp(ctx, d.sprite, at.x, at.y, d.height * ppu, d.flip);
    }
    drawHills(
      ctx,
      width,
      groundY - 0.5 * ppu,
      height,
      0.35 * ppu,
      6 * ppu,
      MEADOW.hillNear,
      scene.seed + 5,
    );
    for (const d of scenery.near) {
      if (Math.abs(d.x) > viewHalf + 2) continue;
      const at = S(d.x, GROUND);
      drawProp(ctx, d.sprite, at.x, at.y + 2, d.height * ppu, d.flip);
    }
  }

  // ── The plinth: a stone pillar standing in the meadow, with a grassy cap ──
  const slab = scene.platformThickness;
  {
    const pillarHalf = halfW * 0.62;
    const top = S(-pillarHalf, -slab);
    const bottom = S(pillarHalf, GROUND - 0.2);
    ctx.fillStyle = MEADOW.stone;
    ctx.fillRect(top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    // A shaded right side, and the stone courses.
    ctx.fillStyle = MEADOW.stoneShade;
    ctx.fillRect(bottom.x - 0.35 * ppu, top.y, 0.35 * ppu, bottom.y - top.y);
    ctx.strokeStyle = MEADOW.stoneLine;
    ctx.lineWidth = Math.max(1, 0.04 * ppu);
    ctx.beginPath();
    const course = 0.55;
    let row = 0;
    for (let y = -slab - 0.3; y > GROUND - 0.2; y -= course, row++) {
      const a = S(0, y);
      ctx.moveTo(top.x, a.y);
      ctx.lineTo(bottom.x, a.y);
      for (let x = -pillarHalf + (row % 2 ? 0.6 : 1.2); x < pillarHalf - 0.1; x += 1.2) {
        const b = S(x, y);
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x, Math.min(b.y + course * ppu, bottom.y));
      }
    }
    ctx.stroke();
    // The cap: earth with a rounded underside, then turf with drips and a bright edge.
    const capL = S(-halfW, 0);
    const capW = scene.platformWidth * ppu;
    const capH = slab * ppu;
    const earth = 0.45 * ppu;
    ctx.fillStyle = MEADOW.dirt;
    ctx.beginPath();
    ctx.moveTo(capL.x, capL.y);
    ctx.lineTo(capL.x + capW, capL.y);
    ctx.lineTo(capL.x + capW, capL.y + capH);
    ctx.quadraticCurveTo(
      capL.x + capW,
      capL.y + capH + earth,
      capL.x + capW * 0.8,
      capL.y + capH + earth,
    );
    ctx.lineTo(capL.x + capW * 0.2, capL.y + capH + earth);
    ctx.quadraticCurveTo(capL.x, capL.y + capH + earth, capL.x, capL.y + capH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = MEADOW.grass;
    ctx.beginPath();
    const corner = Math.min(8, 0.15 * ppu);
    ctx.roundRect(capL.x, capL.y, capW, capH, [corner, corner, 0, 0]);
    for (let i = 0; i < 9; i++) {
      const x = capL.x + ((i + 0.5) / 9) * capW;
      const r = (0.12 + ((i * 7) % 3) * 0.05) * ppu;
      ctx.moveTo(x + r, capL.y + capH);
      ctx.arc(x, capL.y + capH, r, 0, Math.PI);
    }
    ctx.fill();
    ctx.fillStyle = MEADOW.grassLight;
    ctx.fillRect(capL.x + corner, capL.y, capW - 2 * corner, Math.max(2, 0.07 * ppu));
  }

  // ── The meadow in front of the plinth's foot, the village lane, and the villagers on it ──
  if (groundInView) {
    drawHills(ctx, width, groundY, height + 2, 0.08 * ppu, 5 * ppu, MEADOW.grass, scene.seed + 9);
    const lane = S(0, LANE + 0.2).y;
    const laneH = 0.5 * ppu;
    ctx.fillStyle = MEADOW.lane;
    ctx.fillRect(0, lane, width, laneH);
    ctx.fillStyle = MEADOW.laneEdge;
    ctx.fillRect(0, lane + laneH - Math.max(1.5, 0.05 * ppu), width, Math.max(1.5, 0.05 * ppu));
    // The village's props, anyone pinned under a fallen piece, the fallen pieces, then everyone
    // else in front.
    const village = scene.life.village;
    const view: VillageView = {
      S,
      unit: ppu,
      feet: LANE,
      minX: camera.centerX - viewHalf,
      maxX: camera.centerX + viewHalf,
      cheering,
    };
    drawVillageProps(ctx, village, view);
    drawVillagers(ctx, village, view, 'under');
    drawFallout(ctx, scene.life, S, ppu);
    drawVillagers(ctx, village, view, 'over');
    drawCrumbs(ctx, village, view);
  }

  // ── Height ruler on the left edge ──
  ctx.font = `12px ${displayFont()}`;
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = COLORS.ruler;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let gy = Math.max(1, Math.ceil(camera.bottom)); gy < viewTop; gy++) {
    const { y } = S(0, gy);
    ctx.moveTo(3, Math.round(y));
    ctx.lineTo(gy % 5 === 0 ? 15 : 9, Math.round(y));
  }
  ctx.stroke();
  for (let gy = 5 * Math.max(1, Math.ceil(camera.bottom / 5)); gy < viewTop; gy += 5) {
    if (Math.abs(gy - scene.line) > 0.6) outlinedText(ctx, `${gy} m`, 19, S(0, gy).y);
  }

  // ── The topping-out line: a string of bunting, when it's below the HUD bar ──
  const lineY = S(0, scene.line).y;
  const lineVisible = lineY > scene.insetTop + 34;
  if (lineVisible) {
    const y = lineY;
    ctx.strokeStyle = COLORS.rope;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    const step = 22;
    for (let i = 0, x = 4; x < width; x += step, i++) {
      const flutter = cheering ? Math.sin(t * 10 + i) * 3 : Math.sin(t * 2 + i * 0.8) * 1.2;
      ctx.fillStyle = cheering
        ? i % 2
          ? COLORS.gold
          : 'oklch(1 0 0)'
        : (COLORS.pennants[i % COLORS.pennants.length] as string);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + step - 6, y);
      ctx.lineTo(x + (step - 6) / 2 + flutter, y + 15);
      ctx.closePath();
      ctx.fill();
    }
    // The label: a white tag above the bunting.
    const label = `TOP OUT · ${scene.line} m`;
    ctx.font = `13px ${displayFont()}`;
    const tw = ctx.measureText(label).width;
    const lx = width - tw - 22;
    ctx.fillStyle = cheering ? COLORS.gold : 'oklch(1 0 0 / 0.92)';
    ctx.beginPath();
    ctx.roundRect(lx - 8, y - 28, tw + 16, 22, 11);
    ctx.fill();
    ctx.fillStyle = COLORS.label;
    ctx.fillText(label, lx, y - 17);
    if (scene.topping !== null) {
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.roundRect(0, y + 18, width * scene.topping, 6, 3);
      ctx.fill();
    }
  }

  // ── The line's out of sight (above the view, or under the HUD): say where it is ──
  if (!lineVisible) {
    ctx.font = `13px ${displayFont()}`;
    ctx.textAlign = 'right';
    const ty = scene.insetTop + 18;
    outlinedText(ctx, `TOP OUT AT ${scene.line} m`, width - 26, ty);
    ctx.textAlign = 'left';
    // An arrow pointing up at it (the display font has no arrows).
    ctx.fillStyle = COLORS.ruler;
    ctx.beginPath();
    ctx.moveTo(width - 17, ty - 7);
    ctx.lineTo(width - 11, ty + 1);
    ctx.lineTo(width - 23, ty + 1);
    ctx.fill();
    ctx.fillRect(width - 19, ty + 1, 4, 6);
  }

  // ── Current height marker ──
  if (scene.height > 0.05) {
    const { y } = S(0, scene.height);
    ctx.fillStyle = COLORS.marker;
    ctx.strokeStyle = 'oklch(1 0 0)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(1, y - 8);
    ctx.lineTo(14, y);
    ctx.lineTo(1, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // ── Guide column under the piece being placed ──
  // A piece a magpie is still flying in isn't hanging from its balloons yet.
  const active = scene.bodies.find((b) => b.active && b.id !== scene.hide);
  const activeLook = active ? scene.looks.get(active.id) : undefined;
  const guideEdges = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = COLORS.guideEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x, height);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x, height);
    ctx.stroke();
    ctx.restore();
  };
  const guide =
    active && activeLook
      ? (() => {
          const ext = worldExtent(active, activeLook.piece.outline);
          return { a: S(ext.left, ext.bottom), b: S(ext.right, ext.bottom) };
        })()
      : null;
  if (guide) {
    ctx.fillStyle = COLORS.guide;
    ctx.fillRect(guide.a.x, guide.a.y, guide.b.x - guide.a.x, height - guide.a.y);
    guideEdges(guide.a, guide.b);
  }

  // ── Pieces ──
  const fog = scene.fog ?? 0;
  const paintBody = (body: BodyState) => {
    const look = scene.looks.get(body.id);
    if (!look) return;
    const at = S(body.x, body.y);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(-body.angle);
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    paintPiece(ctx, look, ppu);
    ctx.restore();
    if (look.curses?.length) paintCurses(ctx, look, at, body, ppu);
  };
  for (const body of scene.bodies) {
    if (!(fog > 0 && body.active) && body.id !== scene.hide) paintBody(body);
  }

  if (scene.star) drawStar(ctx, S(scene.star.x, scene.star.y), scene.star, ppu, t);
  for (const bird of scene.birds ?? []) {
    // Drawn a little bigger than the pigeon weighs in, to read at a tower's scale. The magpie
    // never lands, so it can be bigger still, and never too small to spot.
    const r =
      bird.kind === 'magpie' ? Math.max(9, PIGEON.radius * 2 * ppu) : PIGEON.radius * 1.3 * ppu;
    const at = S(bird.x, bird.y);
    const carried = bird.carrying === undefined ? undefined : scene.looks.get(bird.carrying);
    if (carried) {
      // Hanging from its feet.
      const size = bird.carrySize ?? 0.6;
      ctx.save();
      ctx.translate(at.x, at.y + CARRY_BELOW * ppu);
      ctx.rotate(Math.sin(t * 3) * 0.12 * (1 - size));
      ctx.shadowColor = COLORS.shadow;
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      paintPiece(ctx, carried, ppu * size);
      ctx.restore();
    }
    drawSpellBird(ctx, at, r, t, bird.facing, bird.flying, PLUMAGE[bird.kind]);
  }

  // ── Fog over the top of the tower: only the piece being placed and its guide show ──
  if (fog > 0) {
    // Low enough that the top of the tower, where the piece lands, is hidden.
    const bottom = S(0, Math.max(0.6, scene.height - 1.8)).y;
    const soft = 1.2 * ppu;
    const veil = ctx.createLinearGradient(0, bottom, 0, bottom - soft);
    veil.addColorStop(0, `oklch(0.93 0.01 250 / 0)`);
    veil.addColorStop(1, `oklch(0.93 0.01 250 / ${fog})`);
    ctx.fillStyle = veil;
    ctx.fillRect(0, bottom - soft, width, soft);
    ctx.fillStyle = `oklch(0.93 0.01 250 / ${fog})`;
    ctx.fillRect(0, 0, width, Math.max(0, bottom - soft));
    // A row of puffs along its lower edge, drifting.
    const puff = 2.2 * ppu;
    for (let x = -puff; x < width + puff; x += puff * 0.7) {
      const drift = Math.sin(t * 0.6 + x * 0.013) * 0.15 * ppu;
      drawCloud(ctx, PROPS.cloud[0], x + drift, bottom - soft * 0.4, puff, fog * 0.9);
    }
    if (guide) guideEdges(guide.a, guide.b);
    if (active) paintBody(active);
  }

  if (scene.showColliders) {
    for (const body of scene.bodies) {
      const look = scene.looks.get(body.id);
      if (!look) continue;
      const at = S(body.x, body.y);
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(-body.angle);
      ctx.scale(ppu, -ppu);
      ctx.lineWidth = 2 / ppu;
      look.piece.parts.forEach((part, i) => {
        ctx.beginPath();
        ctx.moveTo(part[0] as number, part[1] as number);
        for (let k = 2; k + 1 < part.length; k += 2)
          ctx.lineTo(part[k] as number, part[k + 1] as number);
        ctx.closePath();
        const color = COLORS.collider[i % COLORS.collider.length] as string;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      });
      // Centre of mass.
      ctx.fillStyle = body.settled ? '#3dff9e' : '#ff3d6e';
      ctx.fillRect(-0.06, -0.06, 0.12, 0.12);
      ctx.restore();
    }
  }

  // ── The piece being placed floats down under a bunch of balloons ──
  if (active && activeLook) {
    const ext = worldExtent(active, activeLook.piece.outline);
    const knot = S(active.x, ext.top);
    const r = Math.max(9, 0.36 * ppu);
    const bunch = [
      { dx: -0.5, dy: 1.35 },
      { dx: 0.5, dy: 1.3 },
      { dx: 0, dy: 1.75 },
    ];
    const balloons = bunch.map((b, i) => ({
      x: knot.x + b.dx * ppu + Math.sin(t * 1.3 + i) * 0.06 * ppu,
      y: knot.y - b.dy * ppu + Math.sin(t * 2.2 + i * 2) * 0.08 * ppu,
      color: MEADOW.balloons[(i + scene.seed) % MEADOW.balloons.length] as string,
    }));
    ctx.strokeStyle = COLORS.string;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const b of balloons) {
      ctx.moveTo(b.x, b.y + r * 1.15);
      ctx.quadraticCurveTo((b.x + knot.x) / 2, (b.y + knot.y) / 2 + r, knot.x, knot.y - 2);
    }
    ctx.stroke();
    for (const b of balloons) drawBalloon(ctx, b.x, b.y, r, b.color, 0);
  }
}

/**
 * A cursed piece's look over its doodle (docs/tower/planning/power-ups.md): frost on a slippery
 * one.
 */
function paintCurses(
  ctx: CanvasRenderingContext2D,
  look: PieceLook,
  at: { x: number; y: number },
  body: BodyState,
  ppu: number,
): void {
  const curses = look.curses ?? [];
  if (!curses.includes('slippery') && !curses.includes('big_ice')) return;
  const o = look.piece.outline;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(-body.angle);
  ctx.scale(ppu, -ppu);
  ctx.beginPath();
  ctx.moveTo(o[0] as number, o[1] as number);
  for (let k = 2; k + 1 < o.length; k += 2) ctx.lineTo(o[k] as number, o[k + 1] as number);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.fillStyle = COLORS.frost;
  ctx.fill();
  ctx.strokeStyle = COLORS.frostEdge;
  ctx.lineWidth = 3 / ppu;
  ctx.stroke();
  ctx.restore();
}

/** A sky star: a gold star bobbing in place, and a ring that fills while a piece holds it. */
function drawStar(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  star: { radius: number; hold: number },
  ppu: number,
  t: number,
): void {
  const r = star.radius * ppu;
  const y = at.y + Math.sin(t * 2.2) * 0.06 * ppu;
  ctx.save();
  ctx.translate(at.x, y);
  ctx.shadowColor = COLORS.starGlow;
  ctx.shadowBlur = 16 + 6 * Math.sin(t * 3);
  ctx.rotate(Math.sin(t * 1.3) * 0.15);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k);
  }
  ctx.closePath();
  ctx.fillStyle = COLORS.star;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLORS.starEdge;
  ctx.stroke();
  ctx.restore();
  if (star.hold > 0) {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = COLORS.starEdge;
    ctx.beginPath();
    ctx.arc(at.x, y, r * 1.45, -Math.PI / 2, -Math.PI / 2 + star.hold * 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * A spell's bird in its plumage (a pigeon, a magpie), standing on (x, y + r) − r, facing `facing`
 * (−1 left, 1 right). It bobs its head while perched; flying, its wings flap.
 */
function drawSpellBird(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  r: number,
  t: number,
  facing: 1 | -1,
  flying: boolean,
  look: Plumage,
): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(facing, 1);
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = look.edge;
  ctx.lineJoin = 'round';
  const bob = flying ? 0 : Math.max(0, Math.sin(t * 5)) * r * 0.25;
  // Legs.
  if (!flying) {
    ctx.strokeStyle = look.legs;
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, r * 0.55);
    ctx.lineTo(-r * 0.2, r);
    ctx.moveTo(r * 0.2, r * 0.55);
    ctx.lineTo(r * 0.25, r);
    ctx.stroke();
    ctx.strokeStyle = look.edge;
  }
  // Tail and body.
  const tail = look.tail;
  ctx.fillStyle = look.body;
  ctx.beginPath();
  ctx.moveTo(-r * 1.0, -r * 0.05);
  ctx.lineTo(-r * (1 + 0.7 * tail), -r * (0.05 + 0.3 * tail));
  ctx.lineTo(-r * (1 + 0.55 * tail), r * (0.05 + 0.15 * tail));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 1.1, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (look.belly) {
    ctx.fillStyle = look.belly;
    ctx.beginPath();
    ctx.ellipse(r * 0.15, r * 0.35, r * 0.75, r * 0.38, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wing: folded, or flapping.
  const flap = flying ? Math.sin(t * 30) : 0;
  ctx.fillStyle = look.wing;
  ctx.beginPath();
  if (flying) {
    ctx.moveTo(-r * 0.4, -r * 0.1);
    ctx.quadraticCurveTo(-r * 0.2, -r * (0.6 + 1.4 * flap), r * 0.5, -r * 0.1);
  } else {
    ctx.ellipse(-r * 0.15, r * 0.05, r * 0.7, r * 0.38, -0.15, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Neck and head.
  ctx.fillStyle = look.neck;
  ctx.beginPath();
  ctx.ellipse(r * 0.7, -r * 0.35 + bob * 0.5, r * 0.42, r * 0.5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.head;
  ctx.beginPath();
  ctx.arc(r * 0.95, -r * 0.85 + bob, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Beak and eye.
  ctx.fillStyle = look.beak;
  ctx.beginPath();
  ctx.moveTo(r * 1.32, -r * 0.92 + bob);
  ctx.lineTo(r * 1.62, -r * 0.78 + bob);
  ctx.lineTo(r * 1.3, -r * 0.7 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.eye;
  ctx.beginPath();
  ctx.arc(r * 1.05, -r * 0.95 + bob, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
