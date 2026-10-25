import { PlayerSticker } from '@pictiotheme/account/ui';
import { hatFor } from '../../../lib/identity';
import { PORTAL_URL } from '../../../lib/portal';

/**
 * Who you are, in the top-left corner of every screen (docs/technical/decisions.md D13): the "you"
 * sticker every game shares, with your drawing and name (`full`), or just your drawing while a
 * match is on. Until you draw yourself it's your bobble hat. A click changes your name and
 * drawing, for every game; in a room, the crew list follows (`useFollowIdentityInRoom`). `nudge`
 * points an arrow at it asking you to introduce yourself. `fixed` pins it to the corner.
 * `portalLink` puts a "← Games" chip before it, back to the portal: on the home page only.
 */
export function AccountCorner({
  size = 'full',
  nudge = false,
  fixed = true,
  portalLink = false,
}: {
  size?: 'full' | 'avatar';
  nudge?: boolean;
  fixed?: boolean;
  portalLink?: boolean;
}) {
  const sticker = (
    <PlayerSticker
      look={size === 'avatar' ? 'avatar' : 'home'}
      fallbackAvatar={(name) => hatFor(name?.trim() || 'Doodle')}
      portalUrl={PORTAL_URL}
      portalLink={portalLink}
      nudge={nudge}
    />
  );
  // In a header, room for your doodle leaning out of the sticker's top-left corner.
  if (!fixed) return <div className="mt-8 ml-6">{sticker}</div>;
  return (
    <div className={`fixed z-20 ${size === 'avatar' ? 'top-2 left-3' : 'top-12 left-10'}`}>
      {sticker}
    </div>
  );
}
