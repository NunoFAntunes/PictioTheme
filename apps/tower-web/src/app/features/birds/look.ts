import type { Bird } from './birds';

/**
 * How the spells' birds look (docs/tower/planning/power-ups.md): the tower view draws them over
 * its towers, the how-to-play guide in its pictures.
 */

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

/**
 * A spell's bird in its plumage (a pigeon, a magpie), standing on (x, y + r) − r, facing `facing`
 * (−1 left, 1 right). It bobs its head while perched; flying, its wings flap.
 */
export function paintSpellBird(
  ctx: CanvasRenderingContext2D,
  kind: Bird['kind'],
  at: { x: number; y: number },
  r: number,
  t: number,
  facing: 1 | -1,
  flying: boolean,
): void {
  drawSpellBird(ctx, at, r, t, facing, flying, PLUMAGE[kind]);
}

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
