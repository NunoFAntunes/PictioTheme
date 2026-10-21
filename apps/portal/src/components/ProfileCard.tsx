import {
  accountKindOf,
  initialDisc,
  ProfileEditor,
  startAccount,
  useAccount,
} from '@pictiotheme/account';
import { useEffect, useState } from 'react';

/**
 * "You", on the portal: the profile every game uses. Name yourself and draw yourself once here
 * (or in any game) and every game knows you. Accounts (sign up, log in) come later.
 */
export function ProfileCard() {
  const profile = useAccount((s) => s.profile);
  const [editing, setEditing] = useState(false);
  useEffect(() => startAccount(), []);

  const kind = profile ? accountKindOf(profile) : null;
  const avatar = profile ? (profile.drawing ?? initialDisc(profile.displayName)) : null;

  return (
    <section
      aria-labelledby="you"
      className="flex flex-col items-center gap-5 rounded-3xl border-2 border-ink/10 bg-white p-6 shadow-[0_4px_0_rgb(42_33_64/0.15)] sm:flex-row sm:items-center"
    >
      <div className="grid size-28 shrink-0 place-items-center rounded-full bg-paper">
        {avatar ? (
          <img src={avatar} alt="Your avatar" className="size-24 object-contain" />
        ) : (
          <span className="size-24 animate-pulse rounded-full bg-shelf" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center sm:items-start sm:text-left">
        <h2 id="you" className="text-sm font-extrabold tracking-widest text-muted uppercase">
          {kind === 'user' ? 'Your account' : 'You, as a guest'}
        </h2>
        <p className="max-w-full truncate text-3xl font-black">
          {kind === null ? '…' : kind === 'new' ? 'No name yet' : profile?.displayName}
        </p>
        <p className="text-sm text-muted">
          {kind === 'new' || kind === 'named-for-you'
            ? 'Pick a name and draw yourself: every game will know you.'
            : 'Every game uses this name and drawing. Change it here or in any game.'}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          disabled={!profile}
          onClick={() => setEditing(true)}
          className="rounded-full bg-pop px-6 py-2.5 font-extrabold text-white shadow-[0_4px_0_var(--color-pop-dark)] transition hover:brightness-105 active:translate-y-1 active:shadow-none disabled:opacity-60"
        >
          {kind === 'new' || kind === 'named-for-you' ? 'Name yourself' : 'Change'}
        </button>
        <span className="text-xs text-muted">Accounts with log-in are coming soon</span>
      </div>
      {editing && (
        <ProfileEditor
          onClose={() => setEditing(false)}
          avatarOf={(p) => p.drawing ?? initialDisc(p.displayName)}
        />
      )}
    </section>
  );
}
