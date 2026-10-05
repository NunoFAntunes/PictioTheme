import { describe, expect, it } from 'vitest';
import { isAtRest, makeLetterBody, step, type LetterBody, type StepInput } from './letter-physics';

const idle: StepInput = { pointer: null, nudge: false, grab: null, bounds: null };

function run(bodies: LetterBody[], seconds: number, input: StepInput = idle): LetterBody[] {
  let state = bodies;
  for (let t = 0; t < seconds; t += 1 / 60) state = step(state, 1 / 60, input);
  return state;
}

describe('letter physics', () => {
  it('springs a displaced, spinning letter back home and comes to rest', () => {
    const flung = { ...makeLetterBody(100, 100, 40), x: 300, y: -200, vx: 2000, angle: 1, va: 5 };
    const settled = run([flung], 4);
    expect(isAtRest(settled)).toBe(true);
  });

  it('overshoots home before settling, so it wobbles', () => {
    let state = [{ ...makeLetterBody(0, 0, 40), x: 100 }];
    let minX = Infinity;
    for (let i = 0; i < 60; i++) {
      state = step(state, 1 / 60, idle);
      minX = Math.min(minX, state[0]!.x);
    }
    expect(minX).toBeLessThan(0);
  });

  it('pushes overlapping letters apart', () => {
    const [a, b] = step([makeLetterBody(0, 0, 40), makeLetterBody(50, 0, 40)], 1 / 60, idle);
    const gap = b!.homeX + b!.x - (a!.homeX + a!.x);
    expect(gap).toBeGreaterThanOrEqual(79.9);
  });

  it('keeps a held letter at the pointer and lets the others make way', () => {
    const input: StepInput = {
      pointer: { x: 60, y: 10, vx: 0, vy: 0 },
      nudge: false,
      grab: { index: 0, offsetX: 0, offsetY: 10 },
      bounds: null,
    };
    const [held, other] = step(
      [makeLetterBody(0, 0, 40), makeLetterBody(90, 0, 40)],
      1 / 60,
      input,
    );
    expect(held!.homeX + held!.x).toBeCloseTo(60);
    expect(held!.homeY + held!.y).toBeCloseTo(0);
    expect(other!.homeX + other!.x).toBeGreaterThanOrEqual(139.9);
  });

  it('flings a released letter with the speed it was dragged at', () => {
    let state = [makeLetterBody(0, 0, 40)];
    for (let i = 1; i <= 5; i++) {
      state = step(state, 1 / 60, {
        pointer: { x: i * 20, y: 0, vx: 1200, vy: 0 },
        nudge: false,
        grab: { index: 0, offsetX: 0, offsetY: 0 },
        bounds: null,
      });
    }
    expect(state[0]!.vx).toBeGreaterThan(600);
  });

  it('nudges a letter away from a moving cursor, but not from a still one', () => {
    const body = makeLetterBody(0, 0, 40);
    const moving = step([body], 1 / 60, {
      ...idle,
      nudge: true,
      pointer: { x: -20, y: 0, vx: 800, vy: 0 },
    });
    expect(moving[0]!.vx).toBeGreaterThan(0);
    const still = step([body], 1 / 60, {
      ...idle,
      nudge: true,
      pointer: { x: -20, y: 0, vx: 0, vy: 0 },
    });
    expect(isAtRest(still)).toBe(true);
  });

  it('bounces off the bounds instead of leaving them', () => {
    const fast = { ...makeLetterBody(100, 100, 40), vx: 4000 };
    const bounds = { minX: 0, minY: 0, maxX: 300, maxY: 300 };
    let state = [fast];
    for (let i = 0; i < 30; i++) {
      state = step(state, 1 / 60, { ...idle, bounds });
      expect(state[0]!.homeX + state[0]!.x).toBeLessThanOrEqual(260);
    }
  });

  it('survives a zero or huge frame time', () => {
    const body = { ...makeLetterBody(0, 0, 40), x: 50 };
    expect(step([body], 0, idle)).toEqual([body]);
    const [after] = step([body], 10, idle);
    expect(Number.isFinite(after!.x)).toBe(true);
  });
});
