import type { Piece } from '@pictiotheme/doodle-shape';
import type { BodyState, PieceId } from '@pictiotheme/tower-physics';
import type { PieceBitmap } from '../piece';
import { toScreen, type Camera } from './camera';

/**
 * Draws one tower with Canvas 2D (docs/tower/technical/architecture.md#frontend): the blueprint
 * grid that scrolls with the camera, a height ruler, the steel platform, the topping-out line,
 * the pieces as paper cut-outs, and the crane holding the piece being placed.
 * Plain TypeScript, called once per animation frame.
 */

export type PieceLook = { piece: Piece; bitmap: PieceBitmap };

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
  /** CSS px covered by the HUD bar at the top (under the crane's jib). */
  insetTop: number;
  showColliders: boolean;
};

const COLORS = {
  grid: 'oklch(0.8 0.06 245 / 0.07)',
  gridMajor: 'oklch(0.8 0.06 245 / 0.16)',
  chalk: 'oklch(0.96 0.012 240)',
  chalkDim: 'oklch(0.8 0.03 245 / 0.75)',
  steel: 'oklch(0.58 0.02 250)',
  steelDark: 'oklch(0.4 0.02 255)',
  steelLight: 'oklch(0.72 0.015 250)',
  hazard: 'oklch(0.86 0.17 92)',
  hazardInk: 'oklch(0.2 0.02 260)',
  safety: 'oklch(0.72 0.18 48)',
  cable: 'oklch(0.2 0.02 260 / 0.9)',
  guide: 'oklch(0.96 0.012 240 / 0.07)',
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

let displayFont = '';
function fontFamily(): string {
  if (!displayFont) {
    displayFont =
      getComputedStyle(document.documentElement).getPropertyValue('--font-bungee').trim() ||
      'Impact, sans-serif';
  }
  return displayFont;
}

/** Highest and lowest points and horizontal extent of a body's outline, in world units. */
function worldExtent(body: BodyState, outline: readonly number[]) {
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

export function drawTower(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  dpr: number,
  camera: Camera,
  scene: TowerScene,
): void {
  const { width, height } = size;
  const { ppu } = camera;
  const S = (x: number, y: number) => toScreen(camera, size, x, y);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const viewTop = camera.bottom + height / ppu;
  const halfW = scene.platformWidth / 2;

  // ── Grid: 1 unit, heavier every 5, scrolling with the camera ──
  ctx.lineWidth = 1;
  const leftX = camera.centerX - width / 2 / ppu;
  for (let gx = Math.ceil(leftX); gx < leftX + width / ppu; gx++) {
    const { x } = S(gx, 0);
    ctx.strokeStyle = gx % 5 === 0 ? COLORS.gridMajor : COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
    ctx.stroke();
  }
  for (let gy = Math.ceil(camera.bottom); gy < viewTop; gy++) {
    const { y } = S(0, gy);
    ctx.strokeStyle = gy % 5 === 0 ? COLORS.gridMajor : COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
    ctx.stroke();
  }

  // ── Mast under the platform, down past the bottom of the view ──
  const slab = scene.platformThickness;
  const mastHalf = 0.5;
  const mastTop = S(-mastHalf, -slab);
  ctx.fillStyle = COLORS.steelDark;
  ctx.fillRect(mastTop.x, mastTop.y, 2 * mastHalf * ppu, height - mastTop.y);
  ctx.strokeStyle = COLORS.steel;
  ctx.lineWidth = Math.max(1.5, 0.06 * ppu);
  ctx.beginPath();
  for (let y = -slab; y > camera.bottom - 2; y -= 2 * mastHalf) {
    const a = S(-mastHalf, y);
    const b = S(mastHalf, y - 2 * mastHalf);
    const c = S(-mastHalf, y - 2 * mastHalf);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
  }
  ctx.stroke();

  // ── Platform: a steel slab with a hazard-striped face ──
  const pTop = S(-halfW, 0);
  const pW = scene.platformWidth * ppu;
  const pH = slab * ppu;
  ctx.fillStyle = COLORS.steel;
  ctx.fillRect(pTop.x, pTop.y, pW, pH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(pTop.x, pTop.y + pH * 0.35, pW, pH * 0.4);
  ctx.clip();
  ctx.fillStyle = COLORS.hazard;
  ctx.fillRect(pTop.x, pTop.y + pH * 0.35, pW, pH * 0.4);
  ctx.fillStyle = COLORS.hazardInk;
  const stripe = 0.3 * ppu;
  for (let x = pTop.x - pH; x < pTop.x + pW + pH; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, pTop.y + pH * 0.75);
    ctx.lineTo(x + stripe, pTop.y + pH * 0.75);
    ctx.lineTo(x + stripe + pH * 0.4, pTop.y + pH * 0.35);
    ctx.lineTo(x + pH * 0.4, pTop.y + pH * 0.35);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = COLORS.steelLight;
  ctx.fillRect(pTop.x, pTop.y, pW, Math.max(2, 0.08 * ppu));

  // ── Height ruler on the left edge ──
  ctx.font = `11px ${fontFamily()}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.chalkDim;
  ctx.strokeStyle = COLORS.chalkDim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gy = Math.max(0, Math.ceil(camera.bottom)); gy < viewTop; gy++) {
    const { y } = S(0, gy);
    const major = gy % 5 === 0;
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(major ? 14 : 7, Math.round(y) + 0.5);
    if (major && gy > 0 && Math.abs(gy - scene.line) > 0.6) ctx.fillText(`${gy} m`, 18, y);
  }
  ctx.stroke();

  // ── The topping-out line, when it's below the HUD bar ──
  const lineY = S(0, scene.line).y;
  const lineVisible = lineY > scene.insetTop + 24;
  if (lineVisible) {
    const y = lineY;
    const reached = scene.topping !== null;
    ctx.save();
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = reached ? COLORS.hazard : COLORS.chalk;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.restore();
    // A ribbon flag on a little pole at the right.
    const fx = width - 70;
    ctx.fillStyle = COLORS.chalk;
    ctx.fillRect(fx, y - 34, 3, 34);
    ctx.fillStyle = reached ? COLORS.hazard : COLORS.safety;
    ctx.beginPath();
    ctx.moveTo(fx + 3, y - 34);
    ctx.lineTo(fx + 52, y - 27);
    ctx.lineTo(fx + 3, y - 20);
    ctx.fill();
    // The label sits just under the line, clear of the ruler's numbers.
    ctx.fillStyle = reached ? COLORS.hazard : COLORS.chalk;
    ctx.font = `12px ${fontFamily()}`;
    ctx.fillText(`TOP OUT · ${scene.line} m`, 64, y + 18);
    if (scene.topping !== null) {
      ctx.fillStyle = COLORS.hazard;
      ctx.fillRect(0, y + 4, width * scene.topping, 6);
    }
  }

  // ── The line's out of sight (above the view, or under the HUD): say where it is ──
  if (!lineVisible) {
    ctx.font = `12px ${fontFamily()}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.chalkDim;
    const ty = scene.insetTop + 18;
    ctx.fillText(`TOP OUT AT ${scene.line} m`, width - 26, ty);
    ctx.textAlign = 'left';
    // An arrow pointing up at it (the display font has no arrows).
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
    ctx.fillStyle = COLORS.safety;
    ctx.beginPath();
    ctx.moveTo(0, y - 7);
    ctx.lineTo(12, y);
    ctx.lineTo(0, y + 7);
    ctx.fill();
  }

  // ── Guide column under the piece being placed ──
  const active = scene.bodies.find((b) => b.active);
  const activeLook = active ? scene.looks.get(active.id) : undefined;
  if (active && activeLook) {
    const ext = worldExtent(active, activeLook.piece.outline);
    const a = S(ext.left, ext.bottom);
    const b = S(ext.right, ext.bottom);
    ctx.fillStyle = COLORS.guide;
    ctx.fillRect(a.x, a.y, b.x - a.x, height - a.y);
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'oklch(0.96 0.012 240 / 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x, height);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x, height);
    ctx.stroke();
    ctx.restore();
  }

  // ── Pieces ──
  for (const body of scene.bodies) {
    const look = scene.looks.get(body.id);
    if (!look) continue;
    const { piece, bitmap } = look;
    const at = S(body.x, body.y);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(-body.angle);
    // Logical px are y-down like the screen: no flip, just the piece's scale.
    ctx.scale(piece.scale * ppu, piece.scale * ppu);
    ctx.shadowColor = 'oklch(0.1 0.05 260 / 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(
      bitmap.canvas,
      bitmap.x - piece.origin.x,
      bitmap.y - piece.origin.y,
      bitmap.width,
      bitmap.height,
    );
    ctx.restore();
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

  // ── The crane: a jib across the top, a trolley over the piece, a cable and a hook ──
  const jibY = 14;
  ctx.fillStyle = COLORS.hazard;
  ctx.fillRect(0, jibY, width, 10);
  ctx.strokeStyle = COLORS.hazardInk;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < width; x += 20) {
    ctx.moveTo(x, jibY + 10);
    ctx.lineTo(x + 10, jibY);
    ctx.lineTo(x + 20, jibY + 10);
  }
  ctx.stroke();
  if (active && activeLook) {
    const ext = worldExtent(active, activeLook.piece.outline);
    const hook = S(active.x, ext.top);
    ctx.fillStyle = COLORS.steelDark;
    ctx.fillRect(hook.x - 12, jibY + 8, 24, 10);
    ctx.strokeStyle = COLORS.cable;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hook.x, jibY + 18);
    ctx.lineTo(hook.x, hook.y - 8);
    ctx.stroke();
    ctx.strokeStyle = COLORS.steelLight;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hook.x - 3, hook.y - 5, 5, -Math.PI / 2, Math.PI * 0.8);
    ctx.stroke();
  }
}
