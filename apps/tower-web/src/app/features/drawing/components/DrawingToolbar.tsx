import { Button } from '../../../ui/Button';
import { BucketIcon, UndoIcon } from '../../../ui/icons';
import { BRUSH_SIZES, INK_COLORS, type DrawSettings } from '../tools';

/** One row under the board: brush sizes, eraser, bucket, colours, undo and clear. */
export function DrawingToolbar({
  settings,
  onChange,
  onUndo,
  onClear,
  canUndo,
}: {
  settings: DrawSettings;
  onChange: (settings: DrawSettings) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Drawing tools">
      <div className="flex gap-1">
        {BRUSH_SIZES.map(({ name, size }) => (
          <Button
            key={size}
            aria-label={`${name} brush`}
            title={`${name} brush`}
            pressed={settings.tool === 'brush' && settings.size === size}
            onClick={() => onChange({ ...settings, tool: 'brush', size })}
            className="w-9 px-0"
          >
            <span
              className="rounded-full"
              style={{ width: size / 2 + 3, height: size / 2 + 3, background: settings.color }}
            />
          </Button>
        ))}
        <Button
          aria-label="Eraser"
          title="Eraser"
          pressed={settings.tool === 'eraser'}
          onClick={() => onChange({ ...settings, tool: 'eraser' })}
        >
          Erase
        </Button>
        <Button
          aria-label="Paint bucket"
          title="Paint bucket: colours in a closed shape"
          pressed={settings.tool === 'fill'}
          onClick={() => onChange({ ...settings, tool: 'fill' })}
          className="w-10 px-0"
        >
          <BucketIcon color={settings.color} />
        </Button>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="Colour">
        {INK_COLORS.map(({ name, hex }) => {
          const chosen = settings.color === hex;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={name}
              title={name}
              onMouseUp={(e) => e.currentTarget.blur()}
              // Picking a colour keeps the bucket; from the eraser it goes back to the brush.
              onClick={() =>
                onChange({
                  ...settings,
                  color: hex,
                  tool: settings.tool === 'eraser' ? 'brush' : settings.tool,
                })
              }
              className={`size-7 rounded-full border-2 transition pointer-coarse:size-10 ${chosen ? 'scale-110 border-ink ring-2 ring-sun' : 'border-ink/30 hover:scale-105'}`}
              style={{ background: hex }}
            />
          );
        })}
      </div>
      <div className="ml-auto flex gap-1">
        <Button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          className="w-10 px-0 text-lg"
        >
          <UndoIcon />
        </Button>
        <Button onClick={onClear} disabled={!canUndo} aria-label="Clear the drawing">
          Clear
        </Button>
      </div>
    </div>
  );
}
