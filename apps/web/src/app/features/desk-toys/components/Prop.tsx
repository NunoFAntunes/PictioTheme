import { useEffect, useRef, type ReactNode } from 'react';
import { play, POP, SHADOW, type Placement, type ViewBox } from '../toy-kit';

/** Places a drawing by one point of it (see `Placement`). */
export function Prop({
  place,
  viewBox,
  anchor,
  children,
}: {
  place: Placement;
  viewBox: ViewBox;
  anchor: [number, number];
  children: ReactNode;
}) {
  const [minX, minY, w, h] = viewBox;
  const ax = (anchor[0] - minX) * place.unit;
  const ay = (anchor[1] - minY) * place.unit;
  return (
    <div className={`absolute size-0 ${place.className}`}>
      <div
        className="absolute"
        style={{
          left: `${-ax}em`,
          top: `${-ay}em`,
          width: `${w * place.unit}em`,
          height: `${h * place.unit}em`,
          transformOrigin: `${ax}em ${ay}em`,
          rotate: `${place.rotate}deg`,
          viewTransitionName: place.transitionName,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * One layer of a prop. Things lying flat (paint, coffee, crayon doodles) go in one without a shadow.
 * Presses go through it, except on what's marked `TOY`.
 */
export function Layer({
  viewBox,
  shadow,
  children,
}: {
  viewBox: ViewBox;
  shadow?: boolean;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox.join(' ')}
      className={`pointer-events-none absolute inset-0 size-full overflow-visible ${shadow ? SHADOW : ''}`}
    >
      {children}
    </svg>
  );
}

/** Something that appears on a click: it pops in, flung from `fromX`/`fromY` units away. */
export function Spawn({
  fromX,
  fromY,
  children,
}: {
  fromX: number;
  fromY: number;
  children: ReactNode;
}) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    play(
      ref.current,
      [
        { transform: `translate(${fromX}px, ${fromY}px) scale(0.2)`, opacity: 0 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ],
      { duration: 380, easing: POP },
    );
  }, [fromX, fromY]);
  return (
    <g ref={ref} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      {children}
    </g>
  );
}
