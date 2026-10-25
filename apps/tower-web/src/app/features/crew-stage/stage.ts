import type { AvatarId, PlayerId } from '@pictiotheme/protocol';
import { drawCloud } from '../scenery';
import type { Mark, RainCloud, ReactionFrame } from './reactions';
import type { Orb, Particle, Prop, ShowFrame } from './show';
import type { Sticker } from './stickers';
import { effectProgress, type CloudPose, type Effect, type Pose, type TroupeFrame } from './troupe';

/**
 * Draws the crews' avatars where the troupe says they are (`troupe.ts`), acting out the powers
 * (`show.ts`), over the whole game screen: the clouds under placers, the avatars (rolled, squashed
 * and stretched, glowing for a golden word), dust where one took off and stars where two bonked,
 * the thief's mask and loot, orbs flying across and their sparkles, and the crews' reactions
 * (dizzy stars, a startled "!", a rain cloud). Plain TypeScript, called once per animation frame.
 */

const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** A cloud is this many times wider than the avatar on it. */
const CLOUD_WIDTH = 1.9;
/** The cloud sprite's height over its width (Kenney's cloud1, 406×242). */
const CLOUD_ASPECT = 242 / 406;

function drawPlacerCloud(ctx: CanvasRenderingContext2D, c: CloudPose) {
  const width = c.size * CLOUD_WIDTH;
  // Feet sunk a third of the way into the cloud's puff.
  drawCloud(ctx, 'cloud1', c.x, c.y + width * CLOUD_ASPECT * 0.15, width, c.alpha);
}

/** `sticker` standing on the pose's feet: its ink's longer side `size` px. */
function drawFigure(ctx: CanvasRenderingContext2D, pose: Pose, sticker: Sticker) {
  const { image, box } = sticker;
  const scale = pose.size / Math.max(box.width * image.width, box.height * image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const left = -(box.x + box.width / 2) * w;
  const top = -(box.y + box.height) * h;
  ctx.save();
  ctx.globalAlpha = pose.alpha * (pose.asleep ? 0.55 : 1);
  if (pose.asleep) ctx.filter = 'grayscale(1)';
  // Squash and stretch round the feet, roll round the middle.
  ctx.translate(pose.x, pose.y);
  ctx.scale(pose.scaleX, pose.scaleY);
  ctx.translate(0, -pose.size / 2);
  ctx.rotate(pose.angle);
  ctx.translate(0, pose.size / 2);
  ctx.drawImage(image, left, top, w, h);
  ctx.restore();
  if (pose.asleep) {
    const s = pose.size;
    ctx.font = `bold ${Math.round(Math.max(10, s * 0.28))}px "Lilita One", sans-serif`;
    ctx.fillStyle = '#fbf7ee';
    ctx.strokeStyle = '#14213d';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText('z', pose.x + s * 0.3, pose.y - s * 0.85);
    ctx.fillText('z', pose.x + s * 0.3, pose.y - s * 0.85);
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawEffect(ctx: CanvasRenderingContext2D, e: Effect, now: number) {
  const p = effectProgress(e, now);
  ctx.save();
  ctx.globalAlpha = 1 - p * p;
  if (e.kind === 'stars') {
    // A ring of little stars bursting out of the bump.
    ctx.fillStyle = '#f6c93b';
    ctx.strokeStyle = '#14213d';
    ctx.lineWidth = 1.5;
    const reach = e.size * (0.25 + p * 0.55);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + p * 1.5;
      star(ctx, e.x + Math.cos(a) * reach, e.y + Math.sin(a) * reach * 0.6, e.size * 0.11);
    }
  } else {
    // Puffs of dust kicked out sideways from the feet.
    ctx.fillStyle = '#fbf7ee';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const d = e.size * (0.2 + p * (0.35 + i * 0.2));
        ctx.beginPath();
        ctx.arc(
          e.x + side * d,
          e.y - e.size * 0.05 - i * 3,
          e.size * (0.09 + p * 0.06),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** A soft gold glow behind an avatar. */
function drawHalo(ctx: CanvasRenderingContext2D, pose: Pose, alpha: number) {
  const cx = pose.x;
  const cy = pose.y - pose.size * 0.5;
  const r = pose.size * 0.95;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  glow.addColorStop(0, `rgba(255, 214, 90, ${0.85 * alpha})`);
  glow.addColorStop(1, 'rgba(255, 214, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function drawOrb(ctx: CanvasRenderingContext2D, o: Orb) {
  const r = o.size / 2;
  const glow = ctx.createRadialGradient(o.x, o.y, r * 0.4, o.x, o.y, r * 1.8);
  glow.addColorStop(0, o.color);
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(o.x, o.y, r * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fbf7ee';
  ctx.strokeStyle = '#14213d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // A ring of dashes in its colour, spinning round it.
  ctx.strokeStyle = o.color === '#dfe7f2' ? '#fbf7ee' : o.color;
  ctx.setLineDash([r * 0.35, r * 0.3]);
  ctx.lineDashOffset = -o.spin * r * 2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(o.x, o.y, r * 1.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(r * (o.icon.length > 2 ? 0.8 : 1.15))}px ${EMOJI}`;
  ctx.fillText(o.icon, o.x, o.y + r * 0.05, r * 1.7);
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  if (p.shape === 'dot') {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === 'star') {
    ctx.strokeStyle = '#14213d';
    ctx.lineWidth = 1;
    star(ctx, p.x, p.y, p.size);
  } else {
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  }
  ctx.restore();
}

function drawProp(ctx: CanvasRenderingContext2D, p: Prop) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (p.kind === 'mask') {
    // A bandit's mask across the face: a black band with two eye holes, tied at the back.
    const w = p.size;
    const h = p.size * 0.26;
    ctx.fillStyle = '#14213d';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 2, 0);
    ctx.lineTo(w / 2 + h * 0.9, -h * 0.5);
    ctx.lineTo(w / 2 + h * 0.8, h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fbf7ee';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * w * 0.2, 0, h * 0.32, h * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // The stolen drawing: a sheet of paper with a scribble on it.
    const w = p.size;
    const h = p.size * 0.75;
    ctx.fillStyle = '#fbf7ee';
    ctx.strokeStyle = '#14213d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, h * 0.1);
    ctx.quadraticCurveTo(-w * 0.1, -h * 0.35, w * 0.05, h * 0.05);
    ctx.quadraticCurveTo(w * 0.2, h * 0.3, w * 0.3, -h * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMark(ctx: CanvasRenderingContext2D, m: Mark) {
  ctx.save();
  if (m.kind === 'dizzy') {
    // Three little stars going round, on a flat ring over the head.
    ctx.fillStyle = '#f6c93b';
    ctx.strokeStyle = '#14213d';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = m.phase + (i * Math.PI * 2) / 3;
      star(ctx, m.x + Math.cos(a) * m.size * 0.34, m.y + Math.sin(a) * m.size * 0.1, m.size * 0.09);
    }
  } else {
    ctx.globalAlpha = Math.max(0, m.alpha);
    ctx.font = `${Math.round(m.size)}px "Lilita One", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#14213d';
    ctx.fillStyle = '#ff5a4f';
    ctx.strokeText('!', m.x, m.y);
    ctx.fillText('!', m.x, m.y);
  }
  ctx.restore();
}

/** A grey cloud with rain falling from it. */
function drawRain(ctx: CanvasRenderingContext2D, r: RainCloud) {
  const drops = 12;
  const fall = r.width * 0.55;
  ctx.save();
  ctx.globalAlpha = Math.max(0, r.alpha);
  ctx.strokeStyle = '#5b8fd9';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < drops; i++) {
    const x = r.x - r.width * 0.35 + (r.width * 0.7 * (i + 0.5)) / drops + ((i * 7) % 5) - 2;
    const d = (r.time * 0.22 + i * 23) % fall;
    ctx.globalAlpha = Math.max(0, r.alpha) * (1 - d / fall);
    ctx.beginPath();
    ctx.moveTo(x, r.y + d);
    ctx.lineTo(x - 1.5, r.y + d + 7);
    ctx.stroke();
  }
  ctx.globalAlpha = Math.max(0, r.alpha);
  ctx.filter = 'brightness(0.62) saturate(0.4)';
  drawCloud(ctx, 'cloud1', r.x, r.y - r.width * 0.05, r.width, Math.max(0, r.alpha));
  ctx.restore();
}

export function drawStage(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  dpr: number,
  { troupe, show, reactions }: { troupe: TroupeFrame; show: ShowFrame; reactions: ReactionFrame },
  avatars: ReadonlyMap<PlayerId, AvatarId>,
  stickerOf: (avatar: AvatarId) => Sticker | null,
  now: number,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  for (const c of troupe.clouds) drawPlacerCloud(ctx, c);
  for (const e of troupe.effects) if (e.kind === 'dust') drawEffect(ctx, e, now);
  for (const pose of reactions.poses) {
    const halo = show.halos.get(pose.playerId);
    if (halo) drawHalo(ctx, pose, halo);
    const avatar = avatars.get(pose.playerId);
    const sticker = avatar ? stickerOf(avatar) : null;
    if (sticker) drawFigure(ctx, pose, sticker);
  }
  for (const p of show.props) drawProp(ctx, p);
  for (const m of reactions.marks) drawMark(ctx, m);
  for (const r of reactions.rain) drawRain(ctx, r);
  for (const e of troupe.effects) if (e.kind === 'stars') drawEffect(ctx, e, now);
  for (const p of show.particles) drawParticle(ctx, p);
  for (const o of show.orbs) drawOrb(ctx, o);
}
