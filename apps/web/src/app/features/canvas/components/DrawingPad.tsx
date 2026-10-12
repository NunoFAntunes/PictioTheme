import { useState, type ReactNode, type RefObject } from 'react';
import { createStrokeModel, type DrawOp } from '../../../realtime';
import { DEFAULT_TOOL, withColor } from '../tools';
import { useColorPopover } from '../use-color-popover';
import { DrawingBoard } from './DrawingBoard';
import { Toolbar } from './Toolbar';

/**
 * A local drawing pad (the avatar and deck cover pads) with the game's full toolbar, in its panel
 * layout. The strokes stay local: the owner exports the canvas through `canvasRef`.
 *
 * Where there's room (a 42rem container), the tools sit in a column beside the pad, with
 * `children` (the owner's buttons) under them. Narrower, they stack: pad, tools, `children`.
 */
export function DrawingPad({
  size,
  frameClassName,
  label,
  toolsLabel,
  canvasRef,
  children,
}: {
  /** Logical resolution. */
  size: { width: number; height: number };
  /** The pad's frame: its aspect ratio and how big it may get. */
  frameClassName: string;
  label: string;
  toolsLabel: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  children?: ReactNode;
}) {
  const [model] = useState(createStrokeModel);
  const [tool, setTool] = useState({ ...DEFAULT_TOOL, size: 16 });
  const { colorPopover, toggleColorPopover, closeColorPopover } = useColorPopover();
  const [picking, setPicking] = useState(false);
  const [pad] = useState(() => ({
    model,
    emit: (op: DrawOp) => model.apply(op),
    size,
    frameClassName,
    label,
    canvasRef,
  }));

  return (
    <div className="@container w-full">
      <div className="flex flex-col items-center gap-4 @2xl:flex-row @2xl:items-start @2xl:justify-center">
        <div className="flex w-full min-w-0 justify-center @2xl:w-auto @2xl:flex-1">
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
        </div>
        <div className="flex w-full max-w-[22rem] shrink-0 flex-col gap-3 @2xl:w-[22rem]">
          <Toolbar
            tool={tool}
            onChange={setTool}
            onToggleColorPopover={toggleColorPopover}
            emit={pad.emit}
            model={pad.model}
            picking={picking}
            onTogglePicking={() => setPicking((p) => !p)}
            label={toolsLabel}
            layout="panel"
          />
          {children && <div className="flex flex-col gap-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}
