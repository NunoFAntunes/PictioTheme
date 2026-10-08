/**
 * Doodle confetti for the podium: stars, hearts, squiggles, spirals and pencil shavings in the
 * logo's colours, thrown up from a character and falling under gravity. Plain DOM and the Web
 * Animations API, so a burst never re-renders React. Each piece removes itself when it lands.
 */

const SHAPES = [
  { d: 'M12 2 L14.6 8.6 L21.5 9 L16 13.4 L18 20.5 L12 16.6 L6 20.5 L8 13.4 L2.5 9 L9.4 8.6Z' },
  { d: 'M12 20 Q3 13 4 8 Q6 3 12 7.5 Q18 3 20 8 Q21 13 12 20Z' },
  { d: 'M2 14 Q6 4 10 12 T18 12 T22 8', line: true },
  { d: 'M12 12 a2 2 0 1 1 3 1 a4 4 0 1 1 -6 -3 a6.5 6.5 0 1 1 10 5', line: true },
  { d: 'M5 12 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0Z' },
  { d: 'M12 3 L21 19 L3 19Z' },
  { d: 'M2 16 L7 7 L12 16 L17 7 L22 16', line: true },
  { d: 'M3 12 Q12 2 21 12 Q12 8 3 12Z' },
] as const;

const COLOURS: readonly string[] = [
  'var(--color-pop-purple)',
  'var(--color-pop-tomato)',
  'var(--color-pop-sun)',
  'var(--color-pop-teal)',
  'var(--color-pop-pink)',
];

const SVG = 'http://www.w3.org/2000/svg';
const GRAVITY = 900; // px/s²

/** Throws `count` pieces up from `from`'s upper middle, inside `layer` (which clips them). */
export function burstConfetti(layer: HTMLElement, from: HTMLElement, count: number): void {
  const box = layer.getBoundingClientRect();
  const origin = from.getBoundingClientRect();
  const ox = origin.left + origin.width / 2 - box.left;
  const oy = origin.top + origin.height * 0.35 - box.top;
  for (let i = 0; i < count; i++) {
    const shape = SHAPES[i % SHAPES.length] ?? SHAPES[0];
    const colour = COLOURS[i % COLOURS.length] ?? 'var(--color-pop-purple)';
    const size = 14 + Math.random() * 12;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', shape.d);
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'round');
    if ('line' in shape) {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', colour);
      path.setAttribute('stroke-width', '3.2');
    } else {
      path.setAttribute('fill', colour);
      path.setAttribute('stroke', 'var(--color-ink)');
      path.setAttribute('stroke-width', '1.8');
    }
    svg.append(path);
    layer.append(svg);

    const angle = ((-90 + (Math.random() - 0.5) * 150) * Math.PI) / 180;
    const speed = (count > 20 ? 380 : 260) + Math.random() * 380;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const seconds = 1.6 + Math.random() * 1.1;
    const spin = (Math.random() - 0.5) * 1080;
    const frames: Keyframe[] = [];
    for (let f = 0; f <= 10; f++) {
      const t = (f / 10) * seconds;
      const x = ox + vx * t - size / 2;
      const y = oy + vy * t + 0.5 * GRAVITY * t * t - size / 2;
      frames.push({
        transform: `translate(${x}px, ${y}px) rotate(${(spin * f) / 10}deg)`,
        opacity: f > 7 ? 1 - (f - 7) / 3 : 1,
      });
    }
    svg.animate(frames, { duration: seconds * 1000, easing: 'linear' }).onfinish = () =>
      svg.remove();
  }
}
