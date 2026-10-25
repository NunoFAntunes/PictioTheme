import { CURSES, SPELL_TUNING, SPELLS, STAR_TUNING } from '@pictiotheme/protocol/tower';
import type { ReactNode } from 'react';
import { CURSE_LABEL } from '../../../lib/curses';
import { SPELL_LABEL } from '../../../lib/spells';
import { CURSE_LOOPS } from '../loops/curses';
import { drawnBlockLoop } from '../loops/drawn-block';
import { guessLoop } from '../loops/guess';
import { keepCurseLoop } from '../loops/keep-curse';
import { sample, type Loop } from '../loops/paint';
import { placeLoop } from '../loops/place';
import { SPELL_LOOPS } from '../loops/spells';
import { towersLoop } from '../loops/towers';
import { Art } from './Art';
import { LoopCanvas } from './LoopCanvas';
import { powerPage } from './PowerPicker';
import { Doodle } from './sketches';

export const SECTIONS = ['The basics', 'Tricks', 'Powers'] as const;
export type Section = (typeof SECTIONS)[number];

export type GuidePage = {
  section: Section;
  title: string;
  /** What the page says. It has to make sense on its own: the picture is decoration. */
  text: ReactNode;
  /** The picture beside it (hidden from screen readers). */
  art: ReactNode;
  /** It moves: the guide offers to pause it. */
  animated?: boolean;
};

/** A keyboard key, on the card's light background. */
function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded-md border-2 border-ink/25 bg-card-light px-1.5 font-display text-sm leading-6 text-ink shadow-[0_2px_0_var(--color-card-edge)]">
      {children}
    </kbd>
  );
}

/** A looping picture, filling the frame. */
const looping = (loop: Loop) => ({
  animated: true,
  art: (
    <Art bare>
      <LoopCanvas loop={loop} />
    </Art>
  ),
});

function SpellEarning({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-2.5 rounded-xl bg-card-light/80 px-2.5 py-1.5 text-[0.8125rem] leading-snug">
      <span aria-hidden="true" className="text-2xl leading-none">
        {icon}
      </span>
      <span>
        <span className="font-display tracking-wide text-ink">{title}</span>{' '}
        <span className="font-medium text-ink/80">{children}</span>
      </span>
    </li>
  );
}

const secs = (ms: number) => ms / 1000;

const curses = powerPage({
  keys: CURSES,
  loops: CURSE_LOOPS,
  labels: CURSE_LABEL,
  listName: 'Curses',
});
const spells = powerPage({
  keys: SPELLS,
  loops: SPELL_LOOPS,
  labels: SPELL_LABEL,
  listName: 'Spells',
});

/**
 * The guide, page by page (docs/tower/product/game-rules.md, said simply): the basics are enough
 * to start playing; the tricks and the powers are for when you've got the hang of it.
 */
export const PAGES: readonly GuidePage[] = [
  {
    section: 'The basics',
    title: 'Two crews, two towers',
    text: (
      <>
        <p>
          You play in a crew. Each crew builds its own tower, and every block in it is a drawing.
        </p>
        <p>
          The first tower to stand above the bunting for <strong>3 seconds</strong> wins. If it
          drops below, the countdown starts again.
        </p>
      </>
    ),
    ...looping(towersLoop),
  },
  {
    section: 'The basics',
    title: 'Your drawing is the block',
    text: (
      <>
        <p>
          Each round, someone in your crew gets a word and draws it. The moment it’s guessed, the
          drawing becomes a block, in the shape it was drawn.
        </p>
        <p>
          So draw <strong>fast</strong>, and think about the shape: a chunky house stacks nicely. A
          spiky cactus… good luck.
        </p>
      </>
    ),
    ...looping(drawnBlockLoop),
  },
  {
    section: 'The basics',
    title: 'Guess it',
    text: (
      <>
        <p>
          Everyone else types guesses in the guess line. The first right guess turns the drawing
          into a block, and the next drawer starts straight away.
        </p>
        <p>
          Stuck? A third of the way in, your crew sees how long the word is with one letter filled
          in, and later a second one.
        </p>
      </>
    ),
    ...looping(guessLoop),
  },
  {
    section: 'The basics',
    title: 'Keep it or curse it',
    text: (
      <>
        <p>The drawer chooses where the block goes:</p>
        <ul className="space-y-1.5">
          <li>
            <Key>K</Key> <strong>Keep</strong> it for your tower, and place it yourself.
          </li>
          <li>
            <Key>C</Key> <strong>Curse</strong> it and send it to theirs. They have to place it!
          </li>
        </ul>
        <p>Keep the nice shapes, curse the awkward ones. After 5 seconds, it’s Keep.</p>
      </>
    ),
    ...looping(keepCurseLoop),
  },
  {
    section: 'The basics',
    title: 'Place it',
    text: (
      <>
        <p>
          The block floats down under its balloons. You have <strong>15 seconds</strong> to line it
          up; the guide line shows where it will land.
        </p>
        <dl className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1.5 text-sm">
          <dt className="flex gap-1">
            <Key>←</Key>
            <Key>→</Key>
          </dt>
          <dd>Move</dd>
          <dt className="flex gap-1">
            <Key>↑</Key>
            <Key>W</Key>
          </dt>
          <dd>Turn</dd>
          <dt className="flex gap-1">
            <Key>Q</Key>
            <Key>E</Key>
          </dt>
          <dd>Either way</dd>
          <dt>
            <Key>↓</Key>
          </dt>
          <dd>Faster</dd>
          <dt>
            <Key>Space</Key>
          </dt>
          <dd>Drop</dd>
        </dl>
        <p>On a tablet, drag it and use the buttons under the tower.</p>
      </>
    ),
    ...looping(placeLoop),
  },
  {
    section: 'Tricks',
    title: 'Steal their drawing',
    text: (
      <>
        <p>
          The other crew’s drawing hangs small in the sky above their tower. Type its word in your
          guess line before they get it, and the block is <strong>yours</strong>: keep it, or curse
          it right back at them.
        </p>
        <p>Careful: they can steal yours too, and nobody gets letter hints for a steal.</p>
      </>
    ),
    art: (
      <Art>
        <figure className="flex flex-col items-center gap-1">
          <Doodle strokes={sample('house')} className="h-24 w-32 rounded-xl bg-paper" />
          <figcaption className="font-display text-sm text-dusk-800">Your crew’s</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-1 self-start">
          <div className="relative">
            <Doodle strokes={sample('boot')} className="h-12 w-16 rounded-lg bg-paper" />
            <span className="absolute -right-4 -bottom-3 text-2xl">🦝</span>
          </div>
          <figcaption className="font-display text-sm text-dusk-800">Theirs</figcaption>
        </figure>
      </Art>
    ),
  },
  {
    section: 'Tricks',
    title: 'Don’t drop it',
    text: (
      <>
        <p>
          A block that falls off your tower is a <strong>fumble</strong>: it’s gone, and your crew
          is dazed for a few seconds, with no placing. Drawing and guessing carry on.
        </p>
        <p>
          It doesn’t matter whose block it was: a cursed one that falls off dazes the crew it was
          sent to. And even when you’re about to top out, they can still curse one at you.
        </p>
      </>
    ),
    art: (
      <Art className="flex-col gap-1">
        <span className="text-5xl">💫</span>
        <span className="rounded-xl bg-ink px-3 py-1 font-display text-lg text-sun">Dazed!</span>
      </Art>
    ),
  },
  {
    section: 'Powers',
    title: 'Curses',
    text: (
      <>
        <p>
          Every block comes with a curse, shown on the Curse button. It only works if you send the
          block. A ✨ golden word’s has two. Pick one to watch it:
        </p>
        <curses.List />
      </>
    ),
    art: <curses.Picture />,
    animated: true,
  },
  {
    section: 'Powers',
    title: 'Spells',
    text: (
      <>
        <p>
          Hold up to {SPELL_TUNING.maxCharges}. Anyone but the drawer casts one with <Key>1</Key> or{' '}
          <Key>2</Key>; they get a {secs(SPELL_TUNING.warnMs)}-second warning. Pick one to watch:
        </p>
        <spells.List />
      </>
    ),
    art: <spells.Picture />,
    animated: true,
  },
  {
    section: 'Powers',
    title: 'Getting spells',
    text: (
      <>
        <p>
          There are three ways to get a spell. A crew that already holds {SPELL_TUNING.maxCharges}{' '}
          gets nothing, so cast them!
        </p>
        <p>The host can turn curses and spells off.</p>
      </>
    ),
    art: (
      <Art>
        <ul className="w-full space-y-1.5">
          <SpellEarning icon="✨" title="Golden word">
            About one word in {SPELL_TUNING.goldenEvery} is golden. Solve it, or steal it, for a
            spell as well as the block.
          </SpellEarning>
          <SpellEarning icon="🆘" title="Comeback">
            When a block falls off your tower, or you fall far behind.
          </SpellEarning>
          <SpellEarning icon="⭐" title="Sky star">
            Every {secs(STAR_TUNING.everyMs)} seconds a star appears just past the edge of each
            tower. Reach out and touch it with a block for {secs(STAR_TUNING.holdMs)} seconds.
          </SpellEarning>
        </ul>
      </Art>
    ),
  },
];
