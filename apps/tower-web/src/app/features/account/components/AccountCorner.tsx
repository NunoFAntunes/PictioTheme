import { AccountWidget } from '@pictiotheme/account/ui';
import type { CSSProperties } from 'react';
import { hatFor } from '../../../lib/identity';
import { PORTAL_URL } from '../../../lib/portal';

/** The shared widget in Doodle Tower's colours and type (account.css's custom properties). */
const TOWER_LOOK = {
  '--acct-font': 'var(--font-sans)',
  '--acct-bg': 'var(--color-card-light)',
  '--acct-fg': 'var(--color-ink)',
  '--acct-muted': 'oklch(0.27 0.08 275 / 0.65)',
  '--acct-border': 'var(--color-card-edge)',
  '--acct-accent': 'var(--color-coral)',
  '--acct-accent-fg': 'var(--color-cloud)',
  '--acct-paper': 'var(--color-paper)',
  '--acct-radius': '1.5rem',
  '--acct-shadow': '0 4px 0 var(--color-card-edge)',
} as CSSProperties;

/**
 * Who you are, in the top-left corner of every screen (docs/technical/decisions.md D13): your
 * avatar and name (`full`), or just the avatar while a match is on. Your profile is shared with
 * every game; in a room, the crew list follows it (`useFollowIdentityInRoom`). `onEdit` swaps in
 * another editor (the home page's own identity card). `fixed` pins it to the corner.
 */
export function AccountCorner({
  size = 'full',
  onEdit,
  fixed = true,
}: {
  size?: 'full' | 'avatar';
  onEdit?: () => void;
  fixed?: boolean;
}) {
  return (
    <div style={TOWER_LOOK} className={fixed ? 'fixed top-2 left-3 z-20' : ''}>
      <AccountWidget
        size={size}
        fallbackAvatar={(name) => hatFor(name?.trim() || 'Doodle')}
        portalUrl={PORTAL_URL}
        onEdit={onEdit}
      />
    </div>
  );
}
