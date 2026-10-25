import { useCallback, useState } from 'react';

/**
 * What keeps the colour popover "held" after it opens (drawing-tools.md#picking-and-sampling-colours):
 * the pointer that opened it (a middle button, or a finger or pen after a long-press) or the key
 * (`C` or Space, by its `code`). Releasing it over a colour picks that colour.
 */
export type ColorHold = { pointerId: number } | { code: string };

export type ColorPopoverState = {
  /** Where it opened (client coordinates). Null: at the pointer, or the board's centre. */
  at: { x: number; y: number } | null;
  hold: ColorHold | null;
};

export type ToggleColorPopover = (opening?: Partial<ColorPopoverState>) => void;

/** Open/close state for the colour popover, shared by the canvas and the toolbar. */
export function useColorPopover() {
  const [colorPopover, setColorPopover] = useState<ColorPopoverState | null>(null);
  const toggleColorPopover: ToggleColorPopover = useCallback(
    (opening) =>
      setColorPopover((open) =>
        open ? null : { at: opening?.at ?? null, hold: opening?.hold ?? null },
      ),
    [],
  );
  const closeColorPopover = useCallback(() => setColorPopover(null), []);
  return { colorPopover, toggleColorPopover, closeColorPopover };
}
