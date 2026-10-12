import { describe, expect, it } from 'vitest';
import { atRest, dropsIn, speed, step, throwVelocity, type Ball } from './paper-ball';

const BOX = { width: 400, height: 300, radius: 10 };

function roll(ball: Ball, seconds: number): Ball {
  let b = ball;
  for (let t = 0; t < seconds; t += 1 / 60) b = step(b, 1 / 60, BOX).ball;
  return b;
}

describe('paper ball', () => {
  it('slides, slows down and stops', () => {
    const thrown = { x: 50, y: 150, vx: 300, vy: 0 };
    const later = step(thrown, 0.1, BOX).ball;
    expect(later.x).toBeGreaterThan(50);
    expect(speed(later)).toBeLessThan(300);
    expect(atRest(roll(thrown, 5))).toBe(true);
  });

  it('bounces off the edges of its box and stays inside', () => {
    const { ball, bounced } = step({ x: 385, y: 150, vx: 800, vy: 0 }, 0.05, BOX);
    expect(bounced).toBeGreaterThan(0);
    expect(ball.vx).toBeLessThan(0);
    expect(ball.x).toBeLessThanOrEqual(390);

    const wild = roll({ x: 200, y: 150, vx: -2000, vy: 1700 }, 3);
    expect(wild.x).toBeGreaterThanOrEqual(10);
    expect(wild.x).toBeLessThanOrEqual(390);
    expect(wild.y).toBeGreaterThanOrEqual(10);
    expect(wild.y).toBeLessThanOrEqual(290);
  });

  it('drops into the basket only when it gets there slowly', () => {
    const basket = { x: 300, y: 200, radius: 30 };
    expect(dropsIn({ x: 305, y: 195, vx: 100, vy: 0 }, basket)).toBe(true);
    expect(dropsIn({ x: 305, y: 195, vx: 1200, vy: 0 }, basket)).toBe(false);
    expect(dropsIn({ x: 340, y: 200, vx: 0, vy: 0 }, basket)).toBe(false);
  });

  it('is thrown at the speed the pointer let go with', () => {
    const samples = [
      { x: 0, y: 0, t: 0 },
      { x: 10, y: 0, t: 100 },
      { x: 20, y: 5, t: 150 },
      { x: 40, y: 15, t: 200 },
    ];
    // Only the last 90 ms count: from (20, 5) at 150 ms to (40, 15) at 200 ms.
    expect(throwVelocity(samples)).toEqual({ vx: 400, vy: 200 });
  });

  it('treats a tap as no throw, and caps a wild fling', () => {
    expect(throwVelocity([{ x: 5, y: 5, t: 0 }])).toBeNull();
    expect(
      throwVelocity([
        { x: 5, y: 5, t: 0 },
        { x: 6, y: 5, t: 50 },
      ]),
    ).toBeNull();
    const fling = throwVelocity([
      { x: 0, y: 0, t: 0 },
      { x: 500, y: 0, t: 50 },
    ]);
    expect(fling?.vx).toBe(2400);
  });
});
