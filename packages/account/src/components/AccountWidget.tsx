import type { Profile } from '@pictiotheme/protocol';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { startAccount, useAccount } from '../account-store';
import { initialDisc } from '../fallback-avatar';
import { accountKindOf } from '../profile';
import { ProfileEditor } from './ProfileEditor';
import '../account.css';

/**
 * Who you are, in the corner of every game and the portal (docs/technical/decisions.md D13).
 * `full` shows your avatar and name: "Name yourself" until you have one, a Guest tag while you're
 * a guest. `avatar` is just the avatar, small, for while a match is on. Clicking opens a menu
 * (change your name or drawing, all the games), or straight to the editor when you have no name.
 *
 * Styled with `--acct-*` custom properties (account.css), so each game can match its own look.
 */
export function AccountWidget({
  size = 'full',
  fallbackAvatar = initialDisc,
  onEdit,
  onSaved,
  portalUrl,
  className = '',
}: {
  size?: 'full' | 'avatar';
  /** The avatar before they draw themselves (default: their initial on a disc). */
  fallbackAvatar?: (name: string | null) => string;
  /** Opens the game's own editor instead of the built-in one. */
  onEdit?: () => void;
  /** After the built-in editor saved: e.g. tell the room you're in. */
  onSaved?: (profile: Profile) => void;
  /** The portal, for "All games". Left out on the portal itself. */
  portalUrl?: string;
  className?: string;
}) {
  const profile = useAccount((s) => s.profile);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => startAccount(), []);

  // The menu closes on Escape and on a click anywhere else.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const avatarOf = useCallback(
    (p: Profile) => p.drawing ?? fallbackAvatar(p.displayName),
    [fallbackAvatar],
  );
  const edit = () => {
    setMenu(false);
    if (onEdit) onEdit();
    else setEditing(true);
  };

  if (!profile) {
    return (
      <div className={`acct acct-widget acct-size-${size} ${className}`} aria-busy="true">
        <span className="acct-avatar acct-placeholder" />
      </div>
    );
  }

  const kind = accountKindOf(profile);
  const name = profile.displayName;
  const label =
    kind === 'new'
      ? 'Name yourself'
      : `${name ?? ''}${kind === 'user' ? '' : ' (guest)'}: your profile`;

  return (
    <div ref={root} className={`acct acct-widget acct-size-${size} ${className}`}>
      <button
        type="button"
        className="acct-trigger"
        aria-label={label}
        title={size === 'avatar' ? label : undefined}
        aria-haspopup={kind === 'new' ? 'dialog' : 'menu'}
        aria-expanded={kind === 'new' ? undefined : menu}
        aria-controls={menu ? menuId : undefined}
        onClick={() => (kind === 'new' ? edit() : setMenu((m) => !m))}
      >
        <img src={avatarOf(profile)} alt="" className="acct-avatar" draggable={false} />
        {size === 'avatar' && (kind === 'new' || kind === 'named-for-you') && (
          <span className="acct-dot" aria-hidden="true" />
        )}
        {size === 'full' && (
          <span className="acct-text">
            {kind === 'new' ? (
              <span className="acct-name">Name yourself</span>
            ) : (
              <span className="acct-name">{name}</span>
            )}
            <span className="acct-sub">
              {kind === 'new' && 'and draw yourself'}
              {kind === 'named-for-you' && 'Guest · pick your own name'}
              {kind === 'guest' && <span className="acct-tag">Guest</span>}
            </span>
          </span>
        )}
      </button>

      {menu && (
        <div id={menuId} role="menu" className="acct-menu acct-panel">
          <div className="acct-menu-head">
            <img src={avatarOf(profile)} alt="" className="acct-avatar" />
            <div>
              <div className="acct-name">{name}</div>
              <div className="acct-sub">
                {kind === 'user' ? 'Your account' : 'Guest on this browser'}
              </div>
            </div>
          </div>
          <button type="button" role="menuitem" className="acct-item" onClick={edit}>
            {kind === 'named-for-you' ? 'Pick your name and drawing' : 'Change name or drawing'}
          </button>
          {portalUrl && (
            <a role="menuitem" className="acct-item" href={portalUrl}>
              All games
            </a>
          )}
          {kind !== 'user' && (
            <p className="acct-note">
              Your name and drawing go with you to every game. Accounts are coming soon.
            </p>
          )}
        </div>
      )}

      {editing && (
        <ProfileEditor onClose={() => setEditing(false)} onSaved={onSaved} avatarOf={avatarOf} />
      )}
    </div>
  );
}
