import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useRoomStore } from '../../../realtime';
import { PaperBall } from '../../../ui/PaperBall';
import { playSound } from '../../sound';
import { crumpleAndKick } from '../crumple';
import { useCrumple } from '../crumple-store';

/** Resolves once the server has closed the socket, or after `timeoutMs` (it already has the intent). */
function roomClosed(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const isClosed = () => useRoomStore.getState().connection.kind === 'closed';
    if (isClosed()) return resolve();
    const done = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    const unsubscribe = useRoomStore.subscribe(() => {
      if (isClosed()) done();
    });
  });
}

/**
 * Home, on a fresh sheet: no morphing back into the home page's paper (global.css), so its intro
 * plays and a new sheet drops onto the desk. Replaced, so Back doesn't return to the empty desk.
 */
function goHome(): void {
  addEventListener('pageswap', (event) => event.viewTransition?.skipTransition(), { once: true });
  location.replace('/');
}

/**
 * Wraps the room so closing it can crumple it (crumple.ts): the room is the sheet, and while it
 * crumples the ball, the kick's ink marks and the creasing filter are drawn over the desk.
 */
export function CrumpleStage({ className, children }: { className: string; children: ReactNode }) {
  const crumpling = useCrumple((s) => s.crumpling);
  const filterId = useId().replace(/:/g, '');
  const sheet = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLDivElement>(null);
  const marks = useRef<SVGSVGElement>(null);
  const warp = useRef<SVGFETurbulenceElement>(null);
  const bend = useRef<SVGFEDisplacementMapElement>(null);
  const creases = useRef<SVGFETurbulenceElement>(null);
  const shade = useRef<SVGFEDiffuseLightingElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!crumpling || started.current) return;
    started.current = true;
    const parts =
      sheet.current &&
      ball.current &&
      marks.current &&
      warp.current &&
      bend.current &&
      creases.current &&
      shade.current
        ? {
            sheet: sheet.current,
            ball: ball.current,
            marks: marks.current,
            warp: warp.current,
            bend: bend.current,
            creases: creases.current,
            shade: shade.current,
          }
        : null;
    let played = Promise.resolve();
    if (parts && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      playSound('paperCrumple');
      played = crumpleAndKick(parts, () => playSound('paperKick')).catch(() => {});
    }
    void Promise.all([played, roomClosed(2000)]).then(goHome);
  }, [crumpling]);

  return (
    <>
      <div ref={sheet} inert={crumpling} className={className}>
        {children}
      </div>
      {crumpling && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
          <svg className="absolute size-0">
            <filter
              id={filterId}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                ref={warp}
                type="fractalNoise"
                baseFrequency="0.004"
                numOctaves={2}
                seed={1}
                result="warp"
              />
              <feDisplacementMap
                ref={bend}
                in="SourceGraphic"
                in2="warp"
                scale="0"
                xChannelSelector="R"
                yChannelSelector="G"
                result="bent"
              />
              <feTurbulence
                ref={creases}
                type="turbulence"
                baseFrequency="0.004"
                numOctaves={2}
                seed={1}
                result="creases"
              />
              {/* Lit from the top-left; 1/sin(60°) keeps flat paper exactly as bright as before. */}
              <feDiffuseLighting
                ref={shade}
                in="creases"
                surfaceScale="0"
                diffuseConstant={1.155}
                lightingColor="#fff"
                result="shade"
              >
                <feDistantLight azimuth={225} elevation={60} />
              </feDiffuseLighting>
              <feComposite
                in="shade"
                in2="bent"
                operator="arithmetic"
                k1={1}
                k2={0}
                k3={0}
                k4={0}
              />
            </filter>
          </svg>
          <div ref={ball} className="absolute opacity-0 drop-shadow-[0_8px_6px_rgb(0_0_0/0.25)]">
            <PaperBall className="size-full" />
          </div>
          {/* Drawn along +x, the way the ball flies: a burst behind it and two speed lines. */}
          <svg
            ref={marks}
            viewBox="0 0 100 100"
            className="absolute opacity-0"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            {['M21 50 8 50', 'M23 41 13 33', 'M23 59 13 67', 'M42 27 16 31', 'M42 73 16 69'].map(
              (d) => (
                <path key={d} d={d} pathLength={1} strokeDasharray="1" strokeDashoffset="1" />
              ),
            )}
          </svg>
        </div>
      )}
    </>
  );
}
