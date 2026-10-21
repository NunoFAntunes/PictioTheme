import { useMemo, useState } from 'react';
import { makeAvatar } from '../../../lib/avatar';
import { useIdentity } from '../../../lib/identity';
import { Button } from '../../../ui/Button';
import { DrawYourself } from './DrawYourself';
import { NameField } from './NameField';

/**
 * Who you are, on the home page: your avatar standing on a little plinth, a button to draw
 * yourself, and your name. Until you draw, the avatar is the bobble hat made from your name, and
 * it changes as you type. `nudge` (a counter) shakes the card and focuses the name: someone picked
 * a way in without a name.
 */
export function IdentityCard({
  name,
  onName,
  nameOk,
  nudge,
}: {
  name: string;
  onName: (name: string) => void;
  nameOk: boolean;
  nudge: number;
}) {
  const drawn = useIdentity((s) => s.drawn);
  const setDrawing = useIdentity((s) => s.setDrawing);
  const hasIdentity = useIdentity((s) => s.identity !== null);
  const [drawing, setDrawingOpen] = useState(false);
  const hat = useMemo(() => makeAvatar(name.trim() || 'Doodle'), [name]);

  return (
    <section
      aria-label="You"
      key={nudge}
      className={`card-panel flex w-80 flex-col items-center gap-3 rounded-3xl px-6 pt-5 pb-6 ${nudge ? 'animate-nudge' : ''}`}
    >
      <div className="relative flex flex-col items-center">
        <img
          src={drawn ?? hat}
          alt={drawn ? 'Your drawing' : 'Your bobble hat'}
          width={128}
          height={128}
          className="relative z-10 size-32 object-contain drop-shadow-[0_4px_0_oklch(0.27_0.11_278/0.25)]"
        />
        {/* The little plinth you stand on, grassy cap and all. */}
        <div aria-hidden="true" className="-mt-2 flex flex-col items-center">
          <div className="h-4 w-36 rounded-md border-[3px] border-dusk-950 bg-grass" />
          <div className="-mt-[3px] h-5 w-24 rounded-b-md border-[3px] border-t-0 border-dusk-950 bg-[oklch(0.86_0.025_85)]" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="sun" className="h-10 px-4 text-base" onClick={() => setDrawingOpen(true)}>
          {drawn ? '✏️ Redraw me' : '✏️ Draw yourself'}
        </Button>
        {drawn && (
          <Button className="h-10 px-3 text-base" onClick={() => setDrawing(null)}>
            Use the hat
          </Button>
        )}
      </div>

      <div className="w-full">
        <NameField value={name} onChange={onName} autoFocus={!hasIdentity || nudge > 0} />
        <p
          className={`mt-1 h-4 text-xs font-medium ${nudge && !nameOk ? 'text-danger' : 'text-ink/55'}`}
        >
          {nameOk ? '' : 'Pick a name first (2–20 characters).'}
        </p>
      </div>

      {drawing && (
        <DrawYourself
          onClose={() => setDrawingOpen(false)}
          onSave={(avatar) => {
            setDrawing(avatar);
            setDrawingOpen(false);
          }}
        />
      )}
    </section>
  );
}
