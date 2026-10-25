import { openProfileEditor } from '@pictiotheme/account/ui';
import { hasGeneratedAvatar, useIdentity } from '../identity-store';

/**
 * "Draw yourself!" in the waiting room (user-flows.md §5): players who never drew an avatar (they
 * got their initial with a silly name) are asked to draw one while friends arrive. It opens the
 * editor of the room header's "you" sticker, and is gone once you've drawn. The room follows the
 * saved drawing (`useFollowIdentityInRoom`).
 */
export function DrawYourself() {
  const identity = useIdentity((s) => s.identity);
  if (!identity || !hasGeneratedAvatar(identity)) return null;
  return (
    <button
      type="button"
      onClick={openProfileEditor}
      className="flex items-center justify-center gap-2 self-center rounded-full border-2 border-dashed border-pop-pink px-4 py-1.5 text-sm hover:bg-pop-pink/10"
    >
      <span aria-hidden="true">🖍️</span>
      <span>
        You’re still a plain letter. <strong>Draw yourself</strong> while friends arrive!
      </span>
    </button>
  );
}
