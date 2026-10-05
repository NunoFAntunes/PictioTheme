import { sendToRoom } from '../../../realtime';
import { WOBBLE } from '../../../ui/hand-drawn';
import { GlobeIcon, LockIcon } from '../../../ui/ScribbleIcons';

/**
 * Who can join, beside the room's name: a doodled switch between a padlock (private: only people
 * with the code) and a globe (public: listed on the home page). A yellow highlighter blob slides
 * under the one that's on. The host flips it; everyone else sees it.
 */
export function PrivacyToggle({ isPublic, editable }: { isPublic: boolean; editable: boolean }) {
  const hint = isPublic ? 'Listed on the home page' : 'Only people with the code can join';
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={isPublic}
        aria-label="Public room"
        aria-describedby="privacy-hint"
        disabled={!editable}
        title={editable ? `${hint}. Click to make it ${isPublic ? 'private' : 'public'}.` : hint}
        onClick={() => sendToRoom({ t: 'room:details', isPublic: !isPublic })}
        className={`group relative inline-flex items-center ${WOBBLE[2]} border-[2.5px_3px_3.5px_2.5px] border-ink bg-paper p-1 shadow-[2px_3px_0_var(--color-ink)] transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[3px_4px_0_var(--color-ink)] enabled:active:translate-y-0 enabled:active:shadow-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-dashed focus-visible:outline-ink disabled:cursor-default`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] ${WOBBLE[1]} bg-pop-sun/80 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${isPublic ? 'translate-x-full' : ''}`}
        />
        <span className="relative grid size-8 place-items-center">
          <LockIcon
            className={`size-6 transition duration-300 ${isPublic ? 'scale-90 opacity-35 grayscale' : '-rotate-6 scale-110'}`}
          />
        </span>
        <span className="relative grid size-8 place-items-center">
          <GlobeIcon
            className={`size-6 transition duration-300 ${isPublic ? 'rotate-6 scale-110' : 'scale-90 opacity-35 grayscale'}`}
          />
        </span>
      </button>
      <span className="font-logo text-base text-ink" aria-hidden="true">
        {isPublic ? 'Public' : 'Private'}
      </span>
      <span id="privacy-hint" className="sr-only">
        {hint}
      </span>
    </div>
  );
}
