import { useCallback, useState, type ReactNode, type RefObject } from 'react';
import { createStrokeModel, type DrawOp } from '../../../realtime';
import { DEFAULT_TOOL, DrawingBoard, Toolbar, withColor } from '../../canvas';

/**
 * The 3:4 pad for drawing a deck's back cover, with the game's full drawing toolbar (sizes,
 * opacity, fill tolerance, the whole palette, eyedropper, undo/redo and the shortcuts). The
 * strokes stay local: its owner exports the canvas with `drawingToCover`.
 *
 * Where there's room, the tools sit in a column beside the portrait pad, with `children` (the
 * owner's Save/Skip) at its foot, so the whole thing stays about as tall as the pad. On narrow
 * screens they stack: pad, tools, then `children`.
 */

const PAD_SIZE = { width: 600, height: 800 };

export function CoverPad({
  canvasRef,
  children,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  children?: ReactNode;
}) {
  const [model] = useState(createStrokeModel);
  const [tool, setTool] = useState({ ...DEFAULT_TOOL, size: 16 });
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const toggleColorPopover = useCallback(() => setColorPopoverOpen((open) => !open), []);
  const closeColorPopover = useCallback(() => setColorPopoverOpen(false), []);
  const [pad] = useState(() => ({
    model,
    emit: (op: DrawOp) => model.apply(op),
    size: PAD_SIZE,
    // Never taller than the screen; bigger on tablets, where it's drawn on with a finger or a pen.
    frameClassName:
      'aspect-[3/4] w-full max-w-[min(18rem,calc((100dvh_-_10rem)*0.75))] @2xl:max-w-80 pointer-coarse:max-w-sm',
    label: 'Deck cover drawing pad',
    canvasRef,
  }));

  return (
    <div className="@container w-full">
      <div className="flex flex-col items-center gap-3 @xl:flex-row @xl:items-stretch @xl:gap-4">
        <div className="flex w-full shrink-0 justify-center @xl:w-auto">
          <DrawingBoard
            canDraw
            tool={tool}
            onToolChange={(patch) => setTool((t) => ({ ...t, ...patch }))}
            onPickColor={(color) => {
              setTool((t) => withColor(t, color));
              setPicking(false);
            }}
            picking={picking}
            onLiveColor={(color) => setTool((t) => ({ ...t, color }))}
            colorPopoverOpen={colorPopoverOpen}
            onCloseColorPopover={closeColorPopover}
            pad={pad}
          />
        </div>
        <div className="flex w-full max-w-md min-w-0 flex-col gap-3 @xl:max-w-none @xl:flex-1">
          <Toolbar
            tool={tool}
            onChange={setTool}
            onToggleColorPopover={toggleColorPopover}
            emit={pad.emit}
            picking={picking}
            onTogglePicking={() => setPicking((p) => !p)}
            label="Deck cover tools"
          />
          {children && <div className="flex flex-col gap-2 @xl:mt-auto">{children}</div>}
        </div>
      </div>
    </div>
  );
}
