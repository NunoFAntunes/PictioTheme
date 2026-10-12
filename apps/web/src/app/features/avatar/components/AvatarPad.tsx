import { useState, type RefObject } from 'react';
import { createStrokeModel, type DrawOp } from '../../../realtime';
import { DEFAULT_TOOL, DrawingBoard, Toolbar, useColorPopover, withColor } from '../../canvas';

/**
 * The square pad for drawing your avatar, with the game's full drawing toolbar (sizes, opacity,
 * fill tolerance, the whole palette, colour wheel, eyedropper, undo/redo and the shortcuts). The
 * strokes stay local: the identity form exports the canvas (avatar-image.ts).
 */

const PAD_SIZE = { width: 512, height: 512 };

export function AvatarPad({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const [model] = useState(createStrokeModel);
  const [tool, setTool] = useState({ ...DEFAULT_TOOL, size: 16 });
  const { colorPopover, toggleColorPopover, closeColorPopover } = useColorPopover();
  const [picking, setPicking] = useState(false);
  const [pad] = useState(() => ({
    model,
    emit: (op: DrawOp) => model.apply(op),
    size: PAD_SIZE,
    // Bigger on tablets, where it's drawn on with a finger or a pen.
    frameClassName: 'aspect-square w-full max-w-60 pointer-coarse:max-w-xs',
    label: 'Avatar drawing pad',
    canvasRef,
  }));

  return (
    <div className="flex w-full flex-col items-center gap-3">
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
        colorPopover={colorPopover}
        onToggleColorPopover={toggleColorPopover}
        onCloseColorPopover={closeColorPopover}
        pad={pad}
      />
      <Toolbar
        tool={tool}
        onChange={setTool}
        onToggleColorPopover={toggleColorPopover}
        emit={pad.emit}
        model={pad.model}
        picking={picking}
        onTogglePicking={() => setPicking((p) => !p)}
        label="Avatar tools"
      />
    </div>
  );
}
