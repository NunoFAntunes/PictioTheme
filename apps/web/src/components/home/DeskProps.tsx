import { Crayon, Eraser, Mug, Paintbrush } from '../../app/features/desk-toys';

/*
 * Things lying on the desk around the home page's paper (screens.md §1), their inner ends under the
 * sheet. They're toys (features/desk-toys): the mug sloshes and spills, the eraser rubs (click or
 * scrub) and wears down into crumbs, the paintbrush wiggles and its splat grows, and the crayons
 * roll and scribble little doodles on the desk. Server-rendered, then hydrated. Tablets in portrait
 * have no desk beside the paper, so they show from 1024 px wide. The waiting room has its own set
 * (features/waiting-room, ToysAround).
 */
export function DeskProps() {
  return (
    <div aria-hidden="true" className="pointer-events-none hidden select-none lg:block">
      <Mug
        place={{
          className: 'left-6 -bottom-28',
          unit: 0.075,
          rotate: 150,
          transitionName: 'desk-mug',
        }}
      />
      <Eraser
        place={{
          className: 'left-8 -top-14',
          unit: 0.065,
          rotate: -16,
          transitionName: 'desk-eraser',
        }}
      />
      <Paintbrush
        place={{
          className: '-right-6 -bottom-36',
          unit: 0.07,
          rotate: 52,
          transitionName: 'desk-brush',
        }}
      />
      <Crayon
        place={{
          className: '-right-24 top-[42%]',
          unit: 0.07,
          rotate: -8,
          transitionName: 'desk-crayon-teal',
        }}
        color="#4cc9c0"
        shade="#2fa79e"
        side={-1}
      />
      <Crayon
        place={{
          className: '-right-20 top-[57%]',
          unit: 0.07,
          rotate: 12,
          transitionName: 'desk-crayon-green',
        }}
        color="#7ed957"
        shade="#58b532"
        side={1}
      />
    </div>
  );
}
