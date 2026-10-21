import { createStrokeModel, drawingToAvatar } from '@pictiotheme/canvas-engine';
import { DisplayName, type Profile, type UpdateProfileRequest } from '@pictiotheme/protocol';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { saveProfile, useAccount } from '../account-store';
import { DrawingPad } from './DrawingPad';

/**
 * "Your name and drawing": the editor the account widget opens. It saves to the shared profile,
 * so the new name and drawing show in every game. Leaving the pad blank keeps the current
 * drawing. Mounted while open.
 */
export function ProfileEditor({
  onClose,
  onSaved,
  avatarOf,
}: {
  onClose: () => void;
  onSaved?: (profile: Profile) => void;
  /** The avatar to show for a profile (its drawing, or the game's own). */
  avatarOf: (profile: Profile) => string;
}) {
  const profile = useAccount((s) => s.profile);
  const dialog = useRef<HTMLDialogElement>(null);
  const [model] = useState(createStrokeModel);
  // A made-up name is offered as a start, not forced: it's selected so typing replaces it.
  const [name, setName] = useState(profile?.displayName ?? '');
  const [dropDrawing, setDropDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const titleId = useId();

  useEffect(() => dialog.current?.showModal(), []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = DisplayName.safeParse(name);
    if (!parsed.success) {
      setError('Names are 2–20 characters.');
      return;
    }
    const patch: UpdateProfileRequest = { displayName: parsed.data };
    if (model.strokes.length > 0) {
      const drawing = drawingToAvatar(model);
      if (!drawing) {
        setError('That drawing is too detailed to save. Try fewer colours.');
        return;
      }
      patch.drawing = drawing;
    } else if (dropDrawing) {
      patch.drawing = null;
    }
    setBusy(true);
    const result = await saveProfile(patch);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved?.(result.profile);
    dialog.current?.close();
  };

  const current = profile && !dropDrawing ? avatarOf(profile) : null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="acct acct-dialog"
      // A click on the backdrop (the dialog itself, outside the panel) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
    >
      <form className="acct-panel acct-editor" onSubmit={(e) => void submit(e)} noValidate>
        <header className="acct-editor-head">
          <h2 id={titleId}>Your name and drawing</h2>
          <p>One profile for every game: change it here and it changes everywhere.</p>
        </header>

        <div className="acct-field">
          <label htmlFor={nameId}>Your name</label>
          <input
            id={nameId}
            value={name}
            maxLength={20}
            autoComplete="nickname"
            autoFocus
            onFocus={(e) => {
              if (profile && !profile.nameChosen) e.currentTarget.select();
            }}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. Ana"
          />
        </div>

        <fieldset className="acct-field">
          <legend>Draw yourself</legend>
          <DrawingPad model={model} label="Draw yourself" />
          <p className="acct-hint">
            {current && <img src={current} alt="Your current avatar" className="acct-mini" />}
            <span>
              {profile?.drawing && !dropDrawing ? (
                <>
                  Leave the pad blank to keep your drawing, or{' '}
                  <button type="button" className="acct-link" onClick={() => setDropDrawing(true)}>
                    remove it
                  </button>
                  .
                </>
              ) : (
                'Leave the pad blank to skip it.'
              )}
            </span>
          </p>
        </fieldset>

        {error && (
          <p role="alert" className="acct-error">
            {error}
          </p>
        )}
        <footer className="acct-editor-foot">
          <button type="button" className="acct-button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="acct-button acct-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
