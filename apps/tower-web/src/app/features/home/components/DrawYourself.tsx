import { createStrokeModel } from '@pictiotheme/canvas-engine';
import type { AvatarImage } from '@pictiotheme/protocol';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../ui/Button';
import {
  DEFAULT_DRAW_SETTINGS,
  DrawingBoard,
  DrawingToolbar,
  type DrawSettings,
} from '../../drawing';
import { drawingToAvatar } from '../drawn-avatar';

/**
 * "Draw yourself": the game's drawing board in a dialog. Whatever you draw is cut out of the paper,
 * like a block, and becomes your avatar (drawn-avatar.ts). Mounted while it's open, so each time
 * starts on a clean sheet.
 */
export function DrawYourself({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (avatar: AvatarImage) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [model] = useState(createStrokeModel);
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_DRAW_SETTINGS);
  const [strokes, setStrokes] = useState(0);
  const [empty, setEmpty] = useState(false);

  useEffect(() => model.subscribe(() => setStrokes(model.strokes.length)), [model]);
  useEffect(() => dialog.current?.showModal(), []);

  const save = () => {
    const avatar = drawingToAvatar(model);
    if (!avatar) {
      setEmpty(true);
      return;
    }
    onSave(avatar);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="draw-yourself-title"
      onClose={onClose}
      className="m-auto w-[min(40rem,calc((100dvh-14rem)*4/3+3rem))] overflow-visible rounded-3xl bg-transparent backdrop:bg-dusk-950/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="card-panel space-y-3 rounded-3xl p-5">
        <header className="flex items-baseline justify-between gap-4 px-1">
          <h2 id="draw-yourself-title" className="font-display text-3xl tracking-wide text-ink">
            Draw yourself!
          </h2>
          <p className="text-sm font-medium text-ink/65">
            A face, a hat, a cat: it’s cut out like a block.
          </p>
        </header>
        <DrawingBoard model={model} settings={settings} label="Avatar drawing pad" />
        <DrawingToolbar
          settings={settings}
          onChange={setSettings}
          onUndo={() => model.apply({ t: 'draw:undo' })}
          onClear={() => model.apply({ t: 'draw:clear' })}
          canUndo={strokes > 0}
        />
        <footer className="flex items-center justify-end gap-3 pt-1">
          {empty && (
            <p role="status" className="mr-auto text-sm font-semibold text-danger">
              Draw something first!
            </p>
          )}
          <Button className="h-11 px-5 text-base" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="h-11 px-6 text-base" onClick={save}>
            That’s me!
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
