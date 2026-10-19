import { describe, expect, it } from 'vitest';
import {
  BELOW,
  easeCamera,
  HEADROOM,
  MIN_VIEW_HEIGHT,
  SIDE_MARGIN,
  targetCamera,
  toScreen,
} from './camera';

const base = { width: 700, height: 800, platformWidth: 10, reach: 2, towerTop: 0, line: 18 };

describe('targetCamera', () => {
  it('fits the platform and the reach across the view', () => {
    const camera = targetCamera(base);
    // The platform, the reach and a margin on each side, across 700 px.
    expect(camera.ppu).toBeCloseTo(700 / (10 + 2 * (2 + SIDE_MARGIN)));
    const left = toScreen(camera, base, -7, 0);
    const right = toScreen(camera, base, 7, 0);
    expect(left.x).toBeGreaterThan(0);
    expect(right.x).toBeLessThan(base.width);
  });

  it('shows a minimum height in a wide, short view', () => {
    const camera = targetCamera({ ...base, width: 1600, height: 390 });
    expect(390 / camera.ppu).toBeGreaterThanOrEqual(MIN_VIEW_HEIGHT - 1e-9);
  });

  it('starts with the platform near the bottom, and rises with the tower', () => {
    const low = targetCamera(base);
    expect(low.bottom).toBe(-BELOW);
    const tall = targetCamera({ ...base, towerTop: 30, line: 40 });
    const viewHeight = base.height / tall.ppu;
    expect(tall.bottom + viewHeight).toBeCloseTo(30 + HEADROOM);
  });

  it('frames the world between the HUD and the controls', () => {
    const camera = targetCamera({ ...base, insetTop: 80, insetBottom: 70 });
    // The platform's top sits BELOW metres above the controls.
    expect(toScreen(camera, base, 0, 0).y).toBeCloseTo(base.height - 70 - BELOW * camera.ppu);
    const tall = targetCamera({ ...base, towerTop: 30, line: 40, insetTop: 80, insetBottom: 70 });
    expect(toScreen(tall, base, 0, 30 + HEADROOM).y).toBeCloseTo(80);
  });

  it('brings the line into view once the tower is close to it', () => {
    const camera = targetCamera({ ...base, towerTop: 16, line: 18 });
    const top = camera.bottom + base.height / camera.ppu;
    expect(top).toBeGreaterThanOrEqual(18);
  });
});

describe('easeCamera', () => {
  it('moves part of the way each frame and gets there', () => {
    const from = targetCamera(base);
    const to = { ...from, bottom: 10 };
    const next = easeCamera(from, to, 1 / 60);
    expect(next.bottom).toBeGreaterThan(from.bottom);
    expect(next.bottom).toBeLessThan(10);
    let camera = from;
    for (let i = 0; i < 300; i++) camera = easeCamera(camera, to, 1 / 60);
    expect(camera.bottom).toBeCloseTo(10, 3);
  });
});
