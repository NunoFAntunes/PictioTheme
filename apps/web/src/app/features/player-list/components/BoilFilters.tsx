/**
 * The SVG filters behind the characters' line boil: the same doodle displaced by three different
 * noise fields. The `boil` animation (global.css) steps between them, like redrawn cartoon frames.
 * Render once per page; the ids are global.
 */
const SEEDS = [3, 11, 23] as const;

export function BoilFilters() {
  return (
    <svg className="absolute size-0" aria-hidden="true" focusable="false">
      {SEEDS.map((seed, i) => (
        <filter key={seed} id={`player-boil-${i}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seed} />
          <feDisplacementMap
            in="SourceGraphic"
            scale={3.5}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      ))}
    </svg>
  );
}
