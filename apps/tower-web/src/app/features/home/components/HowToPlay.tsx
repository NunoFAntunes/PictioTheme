import { useRef } from 'react';
import { Button } from '../../../ui/Button';

const STEPS = [
  {
    icon: '✏️',
    title: 'Draw it',
    text: 'Your crew guesses your drawing. The other crew can guess it too, and steal it!',
  },
  {
    icon: '🧱',
    title: 'Build or send',
    text: 'A guessed drawing becomes a block. Stack it on your tower, or drop it on theirs.',
  },
  {
    icon: '🎈',
    title: 'Top out',
    text: 'The first tower to stand past the bunting wins. Don’t let it topple!',
  },
];

/** The game in three panels, for anyone who wants it, instead of a paragraph on the home page. */
export function HowToPlay() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-dusk-800 shadow-[0_3px_0_var(--color-card-edge)] hover:bg-white"
      >
        How to play?
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="how-to-play-title"
        className="m-auto w-[min(52rem,calc(100vw-2rem))] rounded-3xl bg-transparent backdrop:bg-dusk-950/50"
        onClick={(e) => {
          // A click on the backdrop closes it.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="card-panel rounded-3xl p-6">
          <h2
            id="how-to-play-title"
            className="mb-4 text-center font-display text-3xl tracking-wide text-ink"
          >
            Two crews, two towers
          </h2>
          <ol className="grid grid-cols-3 gap-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex flex-col items-center gap-2 rounded-2xl bg-sky-light/60 p-4 text-center"
              >
                <span aria-hidden="true" className="text-5xl">
                  {step.icon}
                </span>
                <h3 className="font-display text-xl tracking-wide text-dusk-800">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-sm font-medium text-ink/80">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex justify-center">
            <Button
              variant="primary"
              className="h-11 px-6 text-base"
              onClick={() => dialog.current?.close()}
            >
              Got it!
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
