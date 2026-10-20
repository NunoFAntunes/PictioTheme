import { characterSprite, CHARACTERS, propSprite, type Character } from './sprites';

/**
 * The sunny meadow both the page backdrop and the tower views are drawn in: villagers, clouds,
 * birds and balloons, in screen px. Everything is a pure function of time and a seed, so it
 * needs no state between frames and every tower gets its own, stable scenery.
 */

export const MEADOW = {
  skyTop: 'oklch(0.7 0.14 242)',
  skyHorizon: 'oklch(0.92 0.06 215)',
  /** The sky high above the line, where the tallest towers end up. */
  skyHigh: 'oklch(0.55 0.16 262)',
  hillFar: 'oklch(0.84 0.09 160)',
  hillNear: 'oklch(0.78 0.15 148)',
  grass: 'oklch(0.76 0.19 140)',
  grassLight: 'oklch(0.85 0.17 132)',
  grassDark: 'oklch(0.64 0.17 145)',
  dirt: 'oklch(0.6 0.09 60)',
  /** The village lane at the tower's foot. */
  lane: 'oklch(0.82 0.07 75)',
  laneEdge: 'oklch(0.72 0.08 70)',
  stone: 'oklch(0.86 0.025 85)',
  stoneShade: 'oklch(0.74 0.035 75)',
  stoneLine: 'oklch(0.62 0.04 70)',
  bird: 'oklch(0.3 0.05 265)',
  balloons: [
    'oklch(0.68 0.22 25)',
    'oklch(0.85 0.17 92)',
    'oklch(0.7 0.16 230)',
    'oklch(0.72 0.2 330)',
    'oklch(0.78 0.18 145)',
  ],
};

/** A small, fast, seeded random generator (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wraps `v` into [0, span). */
export function wrap(v: number, span: number): number {
  return ((v % span) + span) % span;
}

// ── Villagers ──

export type Villager = {
  character: Character;
  /** Where they stand: world units in a tower view, a fraction of the width on the backdrop. */
  x: number;
  /** 1 faces right, −1 left. */
  facing: number;
  /** Offsets the cheering hop so villagers don't jump in sync. */
  phase: number;
};

/**
 * Villagers standing at `spots`, each a different character where possible, facing `towards`
 * (a tower) or either way when it's left out. They stay put: no wandering about under the tower.
 */
export function makeVillagers(
  seed: number,
  spots: readonly number[],
  towards?: number,
): Villager[] {
  const rnd = seeded(seed);
  const pool = [...CHARACTERS].sort(() => rnd() - 0.5);
  return spots.map((x, i) => ({
    character: pool[i % pool.length] as Character,
    x,
    facing: towards === undefined ? (rnd() < 0.5 ? -1 : 1) : x < towards ? 1 : -1,
    phase: rnd() * Math.PI * 2,
  }));
}

/**
 * Draws a villager standing on (`x`, `y`), `height` px tall: still, or jumping with arms up
 * when `cheering`.
 */
export function drawVillager(
  ctx: CanvasRenderingContext2D,
  villager: Villager,
  x: number,
  y: number,
  height: number,
  cheering = false,
  t = 0,
): void {
  const beat = t * 6 + villager.phase;
  const pose = cheering ? (Math.sin(beat) > 0 ? 'cheer1' : 'cheer0') : 'idle';
  const img = characterSprite(villager.character, pose);
  if (!img) return;
  const width = height * (img.naturalWidth / img.naturalHeight);
  // The frames leave a little air under the feet.
  const hop = cheering ? Math.abs(Math.sin(beat)) * height * 0.12 : 0;
  const bottom = y + height * 0.04 - hop;
  ctx.save();
  ctx.translate(x, bottom);
  ctx.scale(villager.facing, 1);
  ctx.drawImage(img, -width / 2, -height, width, height);
  ctx.restore();
}

// ── Clouds ──

export type Cloud = { sprite: string; start: number; speed: number; scale: number; alt: number };

/** Draws a cloud sprite centred on (`x`, `y`), `width` px wide. */
export function drawCloud(
  ctx: CanvasRenderingContext2D,
  sprite: string,
  x: number,
  y: number,
  width: number,
  alpha = 1,
): void {
  const img = propSprite(sprite);
  if (!img) return;
  const height = width * (img.naturalHeight / img.naturalWidth);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x - width / 2, y - height / 2, width, height);
  ctx.globalAlpha = 1;
}

/** Draws a prop standing on (`x`, `y`), `height` px tall. */
export function drawProp(
  ctx: CanvasRenderingContext2D,
  sprite: string,
  x: number,
  y: number,
  height: number,
  flip = false,
): void {
  const img = propSprite(sprite);
  if (!img) return;
  const width = height * (img.naturalWidth / img.naturalHeight);
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -width / 2, -height, width, height);
  ctx.restore();
}

// ── Birds and balloons ──

/** A little "m" of a bird, flapping. `size` is its wingspan in px. */
export function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  t: number,
): void {
  const flap = Math.sin(t * 9);
  const half = size / 2;
  const lift = flap * size * 0.22;
  ctx.strokeStyle = MEADOW.bird;
  ctx.lineWidth = Math.max(1.5, size * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - half, y - lift);
  ctx.quadraticCurveTo(x - half * 0.45, y - size * 0.28 - lift * 0.3, x, y);
  ctx.quadraticCurveTo(x + half * 0.45, y - size * 0.28 - lift * 0.3, x + half, y - lift);
  ctx.stroke();
}

/** A party balloon with its string hanging down to (`x`, `y` + `string`). */
export function drawBalloon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  string: number,
  t = 0,
): void {
  const sway = Math.sin(t * 1.7) * radius * 0.25;
  // The string, with a lazy curve.
  ctx.strokeStyle = 'oklch(0.35 0.03 265 / 0.75)';
  ctx.lineWidth = Math.max(1, radius * 0.08);
  ctx.beginPath();
  ctx.moveTo(x, y + radius * 1.15);
  ctx.quadraticCurveTo(x + sway, y + radius * 1.15 + string / 2, x, y + radius * 1.15 + string);
  ctx.stroke();
  // The balloon, a little taller than wide, with a knot and a shine.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, radius * 0.88, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + radius * 0.95);
  ctx.lineTo(x - radius * 0.16, y + radius * 1.18);
  ctx.lineTo(x + radius * 0.16, y + radius * 1.18);
  ctx.fill();
  ctx.fillStyle = 'oklch(1 0 0 / 0.5)';
  ctx.beginPath();
  ctx.ellipse(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.18,
    radius * 0.3,
    -0.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

// ── Hills ──

/**
 * A band of rolling hills: its top edge is a sum of slow sines (stable for a seed), filled down
 * to `bottom`. `offset` scrolls it sideways, in px.
 */
export function drawHills(
  ctx: CanvasRenderingContext2D,
  width: number,
  baseY: number,
  bottom: number,
  amplitude: number,
  wavelength: number,
  color: string,
  seed: number,
  offset = 0,
): void {
  const rnd = seeded(seed);
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let x = 0; x <= width + 8; x += 8) {
    const u = (x + offset) / wavelength;
    const y =
      baseY - amplitude * (0.65 * Math.sin(u * Math.PI * 2 + p1) + 0.35 * Math.sin(u * 5.3 + p2));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, bottom);
  ctx.closePath();
  ctx.fill();
}
