import type { Stroke } from '@pictiotheme/protocol';

/**
 * Hand-built drawings in logical canvas px: the golden-test inputs, and the sandbox's
 * "drop a sample" pieces. Each mimics how people actually draw the thing (outlines, not fills).
 */

type Pt = [number, number];

/** Points every `spacing` px along a polyline, like a pointer reports them. */
function resample(points: readonly Pt[], spacing = 6): Pt[] {
  const out: Pt[] = points.length ? [points[0] as Pt] : [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1] as Pt;
    const [bx, by] = points[i] as Pt;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / spacing));
    for (let k = 1; k <= steps; k++)
      out.push([ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps]);
  }
  return out;
}

let seq = 0;
function line(points: readonly Pt[], size = 8, color = '#1f2937'): Stroke {
  seq += 1;
  return {
    id: `sample${seq}`,
    tool: 'brush',
    color,
    size,
    opacity: 1,
    pts: resample(points).flatMap(([x, y]) => [Math.round(x), Math.round(y), 0.5]),
  };
}

/** Points along an arc, angles in degrees (0 = right, clockwise on screen because y is down). */
function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  n = 48,
): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

export type SampleDrawing = { word: string; strokes: Stroke[] };

export const SAMPLE_DRAWINGS: readonly SampleDrawing[] = [
  // A ball drawn in one go, with the usual small gap where the pen started.
  { word: 'ball', strokes: [line(arc(600, 450, 220, 220, 5, 352))] },
  {
    word: 'brick',
    strokes: [
      line([
        [300, 300],
        [900, 300],
        [900, 600],
        [300, 600],
        [300, 306],
      ]),
    ],
  },
  {
    word: 'banana',
    strokes: [line([...arc(600, 200, 380, 380, 150, 30), ...arc(600, 120, 330, 380, 32, 148)])],
  },
  {
    word: 'star',
    strokes: [
      line(
        Array.from({ length: 11 }, (_, i): Pt => {
          const r = i % 2 === 0 ? 300 : 120;
          const a = ((-90 + i * 36) * Math.PI) / 180;
          return [600 + r * Math.cos(a), 470 + r * Math.sin(a)];
        }),
      ),
    ],
  },
  {
    word: 'stick figure',
    strokes: [
      line(arc(600, 220, 70, 70, 0, 360)),
      line([
        [600, 290],
        [600, 560],
      ]),
      line([
        [480, 380],
        [720, 380],
      ]),
      line([
        [600, 560],
        [500, 760],
      ]),
      line([
        [600, 560],
        [700, 760],
      ]),
    ],
  },
  {
    word: 'skateboard',
    strokes: [
      line(
        [
          [150, 450],
          [1050, 450],
        ],
        24,
      ),
    ],
  },
  {
    word: 'mountain',
    strokes: [
      line([
        [200, 700],
        [600, 200],
        [1000, 700],
        [206, 700],
      ]),
    ],
  },
  {
    word: 'boot',
    strokes: [
      line([
        [450, 150],
        [650, 150],
        [650, 550],
        [900, 550],
        [900, 750],
        [450, 750],
        [450, 156],
      ]),
    ],
  },
  {
    word: 'cactus',
    strokes: [
      line([
        [540, 800],
        [540, 200],
        [660, 200],
        [660, 800],
        [540, 800],
      ]),
      line([
        [540, 500],
        [400, 500],
        [400, 330],
        [460, 330],
        [460, 440],
        [540, 440],
      ]),
      line([
        [660, 420],
        [800, 420],
        [800, 260],
        [740, 260],
        [740, 360],
        [660, 360],
      ]),
    ],
  },
  {
    word: 'house',
    strokes: [
      line([
        [350, 450],
        [850, 450],
        [850, 800],
        [350, 800],
        [350, 450],
      ]),
      line([
        [320, 470],
        [600, 200],
        [880, 470],
      ]),
      line([
        [540, 800],
        [540, 640],
        [660, 640],
        [660, 800],
      ]),
    ],
  },
  { word: 'dot', strokes: [line([[600, 450]], 30)] },
  // A bulb with a screw base, and dashes around it for the shine, none of them touching it.
  {
    word: 'lightbulb',
    strokes: [
      line(arc(600, 360, 170, 170, 0, 360)),
      line([
        [530, 510],
        [530, 660],
        [670, 660],
        [670, 510],
      ]),
      line([
        [530, 580],
        [670, 580],
      ]),
      ...[180, 150, 120, 90, 60, 30, 0].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return line([
          [600 + 215 * Math.cos(a), 360 - 215 * Math.sin(a)],
          [600 + 280 * Math.cos(a), 360 - 280 * Math.sin(a)],
        ]);
      }),
    ],
  },
  {
    word: 'balloon',
    strokes: [
      line(arc(600, 300, 160, 200, 0, 360)),
      line(
        [
          [600, 500],
          [590, 600],
          [615, 700],
          [600, 820],
        ],
        4,
      ),
    ],
  },
];
