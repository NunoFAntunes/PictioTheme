import { useCallback, useState } from 'react';
import { DEFAULT_TOOL, DrawingBoard, Toolbar, withColor } from '../../features/canvas';
import { TurnOverlay } from '../../features/turn-overlays';
import { drawerIdOf, useRoomStore } from '../../realtime';

/**
 * The canvas during a match, with turn overlays and the drawer's toolbar. `bare` when it sits on
 * the room's sheet of paper next to the players (wide screens).
 */
export function GameBoard({ bare = false }: { bare?: boolean }) {
  const view = useRoomStore((s) => s.view);
  const [tool, setTool] = useState(DEFAULT_TOOL);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const toggleColorPopover = useCallback(() => setColorPopoverOpen((open) => !open), []);
  const closeColorPopover = useCallback(() => setColorPopoverOpen(false), []);
  const canDraw =
    !!view &&
    drawerIdOf(view.phase) === view.you &&
    view.phase.kind === 'drawing' &&
    view.paused === null;
  // Close the colour popover when the turn ends or pauses, so it doesn't reopen next turn.
  const [hadCanvas, setHadCanvas] = useState(canDraw);
  if (hadCanvas !== canDraw) {
    setHadCanvas(canDraw);
    if (!canDraw) {
      setColorPopoverOpen(false);
      setPicking(false);
    }
  }
  if (!view) return null;

  return (
    <div className={`flex w-full flex-col gap-2 ${bare ? 'pb-2' : ''}`}>
      <DrawingBoard
        bare={bare}
        canDraw={canDraw}
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
      >
        <TurnOverlay />
      </DrawingBoard>
      {canDraw && (
        <Toolbar
          tool={tool}
          onChange={setTool}
          onToggleColorPopover={toggleColorPopover}
          picking={picking}
          onTogglePicking={() => setPicking((p) => !p)}
        />
      )}
    </div>
  );
}
