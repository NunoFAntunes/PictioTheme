/**
 * Closing the room, played out (screens.md, "Closing the room"): the whole room turns into one
 * sheet of paper, gets scrunched into a ball, and the ball is kicked off the desk. Plain
 * TypeScript on the Web Animations API, no React (CrumpleStage owns the elements).
 *
 * The sheet crumples three ways at once: its outline closes from a rectangle into a lumpy ball
 * (a clip-path polygon with the same points all the way), an SVG filter bends what's on it and
 * shades growing creases, and it shrinks and turns. Just before it's ball-sized, the drawn ball
 * takes its place.
 */

export type CrumpleParts = {
  /** The room, which becomes the sheet. */
  sheet: HTMLElement;
  /** The drawn paper ball (PaperBall), fixed on the page, hidden until the swap. */
  ball: HTMLElement;
  /** Ink marks for the kick: an impact burst and speed lines, in a 100×100 box. */
  marks: SVGSVGElement;
  /** The filter's moving parts. The sheet's CSS filter points at it. */
  warp: SVGFETurbulenceElement;
  bend: SVGFEDisplacementMapElement;
  creases: SVGFETurbulenceElement;
  shade: SVGFEDiffuseLightingElement;
};

const CRUMPLE_MS = 850;
/** The ball fades in over the last part of the crumple. */
const SWAP_MS = 180;
const SETTLE_MS = 220;
const WIND_UP_MS = 160;
const FLIGHT_MS = 650;
/** Points on the sheet's outline: enough that the ball looks lumpy, not polygonal. */
const OUTLINE_POINTS = 40;

const SQUEEZE = 'cubic-bezier(0.55, 0, 0.7, 0.4)';

type Point = [number, number];

/** `n` points evenly spaced along the edge of a w×h rectangle, clockwise from the top-left. */
function rectangleOutline(w: number, h: number, n: number): Point[] {
  const perimeter = 2 * (w + h);
  return Array.from({ length: n }, (_, i) => {
    let d = (i / n) * perimeter;
    if (d < w) return [d, 0];
    d -= w;
    if (d < h) return [w, d];
    d -= h;
    if (d < w) return [w - d, h];
    return [0, h - (d - w)];
  });
}

const jitter = (amount: number) => (Math.random() * 2 - 1) * amount;

/** Each point pulled `pull` of the way to the centre, unevenly: the edges crinkle in. */
function crinkled(points: Point[], cx: number, cy: number, pull: number): Point[] {
  return points.map(([x, y]) => {
    const t = pull + jitter(pull * 0.6);
    return [x + (cx - x) * t, y + (cy - y) * t];
  });
}

/** Each point moved to the same angle on a lumpy circle of radius `r`. */
function lumpyCircle(points: Point[], cx: number, cy: number, r: number): Point[] {
  return points.map(([x, y], i) => {
    const angle = Math.atan2(y - cy, x - cx);
    const radius = r * (1 + (i % 2 ? 0.1 : -0.06) + jitter(0.07));
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

const polygon = (points: Point[]) =>
  `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;

const easeIn = (t: number) => t * t;

/** Bends and creases the sheet more and more over the crumple, re-jittering "on twos". */
function animateFilter(parts: CrumpleParts, duration: number): void {
  const start = performance.now();
  let seed = 1;
  let lastSeedAt = start;
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    parts.bend.setAttribute('scale', String(110 * easeIn(t)));
    parts.creases.setAttribute('baseFrequency', String(0.004 + 0.022 * t));
    parts.shade.setAttribute('surfaceScale', String(14 * t));
    parts.warp.setAttribute('baseFrequency', String(0.004 + 0.008 * t));
    if (now - lastSeedAt > 90) {
      seed += 1;
      lastSeedAt = now;
      parts.warp.setAttribute('seed', String(seed));
      parts.creases.setAttribute('seed', String(seed));
    }
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * Crumples the sheet into a ball and kicks it away. Calls `onKick` as the ball is kicked (for the
 * sound) and resolves once it's off the screen.
 */
export async function crumpleAndKick(parts: CrumpleParts, onKick: () => void): Promise<void> {
  const { sheet, ball, marks } = parts;
  const { width: w, height: h } = sheet.getBoundingClientRect();
  const cx = w / 2;
  const cy = h / 2;
  // On the screen the ball is about a tenth of the room; on the (shrinking) sheet it's bigger.
  const ballRadius = Math.min(110, Math.max(56, Math.min(w, h) * 0.1));
  const sheetRadius = Math.min(w, h) * 0.42;
  const endScale = ballRadius / sheetRadius;

  const outline = rectangleOutline(w, h, OUTLINE_POINTS);
  sheet.style.transformOrigin = `${cx}px ${cy}px`;
  sheet.style.filter = `url(#${parts.bend.closest('filter')?.id ?? ''})`;
  animateFilter(parts, CRUMPLE_MS);
  sheet.animate(
    [
      { backgroundColor: 'transparent', offset: 0 },
      { backgroundColor: 'var(--color-paper)', offset: 0.15 },
      { backgroundColor: 'var(--color-paper)', offset: 1 },
    ],
    { duration: CRUMPLE_MS, fill: 'forwards' },
  );
  sheet.animate(
    [
      { clipPath: polygon(outline), transform: 'none', easing: 'ease-out' },
      {
        clipPath: polygon(crinkled(outline, cx, cy, 0.08)),
        transform: 'scale(0.96) rotate(-2deg)',
        offset: 0.2,
      },
      {
        clipPath: polygon(crinkled(outline, cx, cy, 0.3)),
        transform: `scale(${(1 + endScale) / 2.4}) rotate(-7deg)`,
        offset: 0.6,
      },
      {
        clipPath: polygon(lumpyCircle(outline, cx, cy, sheetRadius)),
        transform: `scale(${endScale}) rotate(14deg)`,
      },
    ],
    { duration: CRUMPLE_MS, easing: SQUEEZE, fill: 'forwards' },
  );
  const sheetGone = sheet.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: SWAP_MS,
    delay: CRUMPLE_MS - SWAP_MS,
    fill: 'forwards',
  });

  // The ball takes the sheet's place, turned the way the sheet ended up.
  const rect = sheet.getBoundingClientRect();
  Object.assign(ball.style, {
    left: `${rect.left + cx - ballRadius}px`,
    top: `${rect.top + cy - ballRadius}px`,
    width: `${ballRadius * 2}px`,
    height: `${ballRadius * 2}px`,
  });
  ball.animate(
    [
      { opacity: 0, transform: 'scale(1.15) rotate(10deg)' },
      { opacity: 1, transform: 'scale(1) rotate(14deg)' },
    ],
    { duration: SWAP_MS, delay: CRUMPLE_MS - SWAP_MS, fill: 'forwards' },
  );
  await sheetGone.finished;

  // A last squeeze settles, then the wind-up: squashed back against the kick.
  await ball.animate(
    [
      { transform: 'scale(1) rotate(14deg)' },
      { transform: 'scale(1.08, 0.94) rotate(10deg)', offset: 0.4 },
      { transform: 'scale(1) rotate(8deg)' },
    ],
    { duration: SETTLE_MS, easing: 'ease-out', fill: 'forwards' },
  ).finished;
  await ball.animate(
    [
      { transform: 'scale(1) rotate(8deg)' },
      { transform: 'translate(-9%, 7%) scale(1.14, 0.84) rotate(2deg)' },
    ],
    { duration: WIND_UP_MS, easing: 'ease-in', fill: 'forwards' },
  ).finished;

  // Kicked off the top-right of the desk, lifting towards you as it goes.
  onKick();
  const bx = rect.left + cx;
  const by = rect.top + cy;
  const dx = innerWidth - bx + ballRadius * 3;
  const dy = -(by + ballRadius * 3);
  const flightAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const markSize = ballRadius * 4;
  Object.assign(marks.style, {
    left: `${bx - markSize / 2}px`,
    top: `${by - markSize / 2}px`,
    width: `${markSize}px`,
    height: `${markSize}px`,
    transform: `rotate(${flightAngle}deg)`,
  });
  marks.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], {
    duration: FLIGHT_MS * 0.8,
    fill: 'forwards',
  });
  for (const path of marks.querySelectorAll('path')) {
    path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: 160,
      easing: 'ease-out',
      fill: 'forwards',
    });
  }
  await ball.animate(
    [
      { transform: 'translate(-9%, 7%) scale(1.14, 0.84) rotate(2deg)' },
      { transform: 'translate(0, 0) scale(0.9, 1.1) rotate(40deg)', offset: 0.08 },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.6}px) scale(1.5) rotate(300deg)`,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(1.25) rotate(560deg)` },
    ],
    { duration: FLIGHT_MS, easing: 'cubic-bezier(0.15, 0.6, 0.45, 1)', fill: 'forwards' },
  ).finished;
}
