import { useCallback, useState, type RefObject } from 'react';
import { createStrokeModel, type DrawOp } from '../../../realtime';
import { DEFAULT_TOOL, DrawingBoard, Toolbar, withColor } from '../../canvas';

/**
 * The 3:4 pad for drawing a deck's back cover, with the game's full drawing toolbar (sizes,
 * opacity, fill tolerance, the whole palette, eyedropper, undo/redo and the shortcuts). The
 * strokes stay local: its owner exports the canvas with `drawingToCover`.
 */

const PAD_SIZE = { width: 600, height: 800 };

export function CoverPad({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
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
    // Bigger on tablets, where the pad is drawn on with a finger or a pen.
    frameClassName: 'aspect-[3/4] w-full max-w-72 pointer-coarse:max-w-sm',
    label: 'Deck cover drawing pad',
    canvasRef,
  }));

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2">
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
      <Toolbar
        tool={tool}
        onChange={setTool}
        onToggleColorPopover={toggleColorPopover}
        emit={pad.emit}
        picking={picking}
        onTogglePicking={() => setPicking((p) => !p)}
        label="Deck cover tools"
      />
    </div>
  );
}
