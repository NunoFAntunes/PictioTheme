import { useState } from 'react';
import {
  DEFAULT_TOOL,
  DrawingBoard,
  Toolbar,
  useColorPopover,
  withColor,
} from '../../features/canvas';
import { LikeButton } from '../../features/likes';
import { TurnOverlay } from '../../features/turn-overlays';
import { drawAndSend, drawerIdOf, strokeModel, useRoomStore } from '../../realtime';

/**
 * The canvas during a match, with turn overlays and the drawer's toolbar. `bare` when it sits on
 * the room's sheet of paper next to the players (wide screens).
 */
export function GameBoard({ bare = false }: { bare?: boolean }) {
  const view = useRoomStore((s) => s.view);
  const [tool, setTool] = useState(DEFAULT_TOOL);
  const { colorPopover, toggleColorPopover, closeColorPopover } = useColorPopover();
  const [picking, setPicking] = useState(false);
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
      closeColorPopover();
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
        colorPopover={colorPopover}
        onToggleColorPopover={toggleColorPopover}
        onCloseColorPopover={closeColorPopover}
        model={strokeModel}
        emit={drawAndSend}
      >
        <TurnOverlay />
        <LikeButton />
      </DrawingBoard>
      {canDraw && (
        <Toolbar
          tool={tool}
          onChange={setTool}
          onToggleColorPopover={toggleColorPopover}
          picking={picking}
          onTogglePicking={() => setPicking((p) => !p)}
          emit={drawAndSend}
          model={strokeModel}
        />
      )}
    </div>
  );
}
