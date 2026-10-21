import { useEffect, useRef } from 'react';
import {
  drawBalloon,
  drawBird,
  drawCloud,
  drawHills,
  drawProp,
  MEADOW,
  seeded,
  wrap,
} from '../meadow';
import {
  addDrops,
  backdropLayout,
  createDropLife,
  drawDrops,
  emitBackdrop,
  orderBuilders,
  stepDrops,
  takeBackdropOrders,
} from '../backdrop-drops';
import { onSpriteLoad, preloadScenery, PROPS, propSprite } from '../sprites';
import { createBackdropVillage, stepVillage, takeCues, type Village } from '../village';
import { drawCrumbs, drawVillageProps, drawVillagers, type VillageView } from '../village-draw';

type Decor = { sprite: string; at: number; height: number; flip: boolean };

/** Trees, bushes and houses along the horizon, at fractions of the width. Stable per load. */
function makeDecor(): Decor[] {
  const rnd = seeded(11);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rnd() * list.length)] as T;
  const decor: Decor[] = [];
  for (let at = 0.02; at < 1; at += 0.07 + rnd() * 0.08) {
    const kind = rnd();
    if (kind < 0.3) decor.push({ sprite: pick(PROPS.house), at, height: 1.4, flip: rnd() < 0.5 });
    else if (kind < 0.55) decor.push({ sprite: pick(PROPS.tree), at, height: 1.9, flip: false });
    else if (kind < 0.6) decor.push({ sprite: pick(PROPS.sapling), at, height: 0.9, flip: false });
    else if (kind < 0.7) decor.push({ sprite: 'fence', at, height: 0.5, flip: false });
    else decor.push({ sprite: pick(PROPS.bush), at, height: 0.55, flip: rnd() < 0.5 });
  }
  return decor;
}
const DECOR = makeDecor();

const CLOUDS = (() => {
  const rnd = seeded(23);
  return Array.from({ length: 7 }, (_, i) => ({
    sprite: PROPS.cloud[i % PROPS.cloud.length] as string,
    start: rnd(),
    speed: 6 + rnd() * 10,
    scale: 0.7 + rnd() * 0.7,
    alt: 0.06 + rnd() * 0.5,
  }));
})();

/**
 * The page behind every screen: a sunny sky with clouds drifting by, rolling hills, a meadow
 * with trees and a village of little houses, and villagers busy with their jobs along the bottom
 * (`village.ts`). Nothing falls on them, unless the page drops something (`backdrop-drops.ts`: the
 * home page's menu, when all its balloons are popped). One canvas, fixed behind the content, drawn every
 * frame (once only with reduced motion, villagers frozen mid-job).
 */
export function SceneBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    preloadScenery();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const t0 = performance.now();
    let frame = 0;
    let last = t0;
    let village: Village | null = null;
    let drops = createDropLife();
    const rnd = seeded(5);

    const render = (now: number) => {
      if (!still.matches) frame = requestAnimationFrame(render);
      const t = still.matches ? 40 : (now - t0) / 1000 + 40;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
      if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { ground, horizon, feet, unitPx, halfSpan } = backdropLayout(width, height);
      const unit = ground; // Props are sized in "ground heights".

      // Sky.
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, MEADOW.skyTop);
      sky.addColorStop(1, MEADOW.skyHorizon);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // The sun, with a soft glow that breathes.
      const sunR = Math.min(70, width * 0.06);
      const sx = width - sunR * 2.2;
      const sy = sunR * 2;
      const glow = ctx.createRadialGradient(
        sx,
        sy,
        sunR * 0.6,
        sx,
        sy,
        sunR * (2.6 + 0.2 * Math.sin(t)),
      );
      glow.addColorStop(0, 'oklch(0.97 0.1 95 / 0.7)');
      glow.addColorStop(1, 'oklch(0.97 0.1 95 / 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - sunR * 3, sy - sunR * 3, sunR * 6, sunR * 6);
      const sun = propSprite('sun');
      if (sun) ctx.drawImage(sun, sx - sunR, sy - sunR, sunR * 2, sunR * 2);

      // Clouds drift left to right and wrap round.
      for (const c of CLOUDS) {
        const w = Math.min(260, width * 0.18) * c.scale;
        const x = wrap(c.start * (width + w) + c.speed * t, width + w * 2) - w;
        drawCloud(ctx, c.sprite, x, horizon * c.alt + w * 0.2, w, 0.95);
      }

      // Balloons rising slowly, now and then.
      for (let i = 0; i < 3; i++) {
        const cycle = 70 + i * 23;
        const p = wrap(t + i * 31, cycle) / cycle;
        const bx = width * (0.15 + 0.32 * i) + Math.sin(t * 0.4 + i) * 30;
        const by = horizon - p * (horizon + 120);
        drawBalloon(
          ctx,
          bx,
          by,
          13,
          MEADOW.balloons[i % MEADOW.balloons.length] as string,
          34,
          t + i,
        );
      }

      // A small flock crossing every so often.
      const flight = wrap(t, 48) / 48;
      for (let i = 0; i < 4; i++) {
        const bx = -80 + flight * (width + 200) - i * 26;
        const by = horizon * 0.32 + Math.sin(t * 0.8 + i) * 8 + (i % 2) * 14;
        drawBird(ctx, bx, by, 14 - i, t + i * 0.7);
      }

      // Hills, far then near.
      drawHills(
        ctx,
        width,
        horizon - unit * 0.55,
        height,
        unit * 0.35,
        width * 0.6,
        MEADOW.hillFar,
        3,
      );
      drawHills(
        ctx,
        width,
        horizon - unit * 0.12,
        height,
        unit * 0.18,
        width * 0.35,
        MEADOW.hillNear,
        5,
      );

      // Trees, houses and bushes on the horizon.
      for (const d of DECOR)
        drawProp(ctx, d.sprite, d.at * width, horizon + 4, d.height * unit, d.flip);

      // The meadow in front.
      ctx.fillStyle = MEADOW.grass;
      ctx.fillRect(0, horizon, width, ground);
      ctx.fillStyle = MEADOW.grassLight;
      ctx.fillRect(0, horizon, width, 5);

      // Villagers, busy. Built for the window's width (again if it changes much), in units of
      // their own height.
      if (!village || Math.abs(village.halfSpan - halfSpan) > halfSpan * 0.1) {
        village = createBackdropVillage(7, halfSpan, 0);
        // Start mid-afternoon rather than with everyone fresh on their marks.
        for (let i = 0; i < 60; i++) stepVillage(village, 0.1);
        // Whatever was dropped on the old one is gone with it.
        if (drops.busy) emitBackdrop({ kind: 'cleared' });
        drops = createDropLife();
      }
      const toWorld = (px: number, py: number) => ({
        x: (px - width / 2) / unitPx,
        y: (feet - py) / unitPx,
      });
      for (const order of takeBackdropOrders()) {
        if (order.kind === 'drop') addDrops(drops, order.drops, unitPx, toWorld, rnd);
        else orderBuilders(village, order, unitPx, toWorld);
      }
      const cleared = stepDrops(drops, village, dt, still.matches);
      if (!still.matches) stepVillage(village, dt);
      for (const cue of takeCues(village))
        emitBackdrop({ kind: 'cue', cue, pan: (cue.x / halfSpan) * 0.6 });
      if (cleared) emitBackdrop({ kind: 'cleared' });
      const view: VillageView = {
        S: (x, y) => ({ x: width / 2 + x * unitPx, y: feet - y * unitPx }),
        unit: unitPx,
        feet: 0,
        minX: -halfSpan,
        maxX: halfSpan,
        cheering: false,
      };
      drawVillageProps(ctx, village, view);
      drawVillagers(ctx, village, view, 'under');
      drawDrops(ctx, drops, village, view.S, unitPx);
      drawVillagers(ctx, village, view, 'over');
      drawCrumbs(ctx, village, view);
    };

    // One loop at a time: a redraw replaces the pending frame (and restarts the loop).
    const redraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    redraw();
    const offLoad = onSpriteLoad(() => {
      if (still.matches) redraw();
    });
    still.addEventListener('change', redraw);
    window.addEventListener('resize', redraw);
    return () => {
      cancelAnimationFrame(frame);
      offLoad();
      still.removeEventListener('change', redraw);
      window.removeEventListener('resize', redraw);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
