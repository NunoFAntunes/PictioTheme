import { MAX_BRUSH_SIZE, MAX_FILL_TOLERANCE, MIN_BRUSH_SIZE } from '@pictiotheme/protocol';
import { MOD } from '../shortcut-hints';
import { SIZE_PRESETS, type ToolSettings } from '../tools';
import { Slider, SliderStack, Zone } from './ToolbarParts';

const DRAG_HINT = `Or right-drag / ${MOD}-drag on the canvas: ↔ size, ↕ opacity`;

/** How big each preset's dot is drawn, in px: their sizes in order, squeezed to fit a button. */
const DOTS = [4, 7, 11, 16];

/** A thin-to-thick wedge: the size track. */
const WEDGE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 10' preserveAspectRatio='none'%3E%3Cpath d='M2 4.5 100 0v10L2 5.5z' fill='%23a1a1aa'/%3E%3C/svg%3E\") center / 100% 100% no-repeat";
const CHECKER = 'repeating-conic-gradient(#d4d4d8 0 25%, #fff 0 50%) 0 0 / 8px 8px';
const TOLERANCE = 'linear-gradient(to right, #fafafa, #52525b)';

/** The current colour from clear to solid, over a checkerboard: the opacity track. */
function opacityTrack(color: string): string {
  return `linear-gradient(to right, ${color}00, ${color}), ${CHECKER}`;
}

/**
 * Size (dots at their relative size, and a slider) and opacity for the brush and eraser.
 * On Fill, tolerance takes size's place: fill has no size.
 */
export function BrushControls({
  tool,
  onChange,
}: {
  tool: ToolSettings;
  onChange: (next: ToolSettings) => void;
}) {
  const opacity = (
    <Slider
      label="Opacity"
      value={Math.round(tool.opacity * 100)}
      min={5}
      max={100}
      step={5}
      display={`${Math.round(tool.opacity * 100)}%`}
      track={opacityTrack(tool.color)}
      hint={DRAG_HINT}
      onChange={(v) => onChange({ ...tool, opacity: v / 100 })}
    />
  );

  if (tool.tool === 'fill')
    return (
      <Zone label="Fill">
        <SliderStack>
          <Slider
            label="Tolerance"
            ariaLabel="Fill tolerance"
            value={tool.fillTolerance}
            min={0}
            max={MAX_FILL_TOLERANCE}
            display={String(tool.fillTolerance)}
            track={TOLERANCE}
            hint={`How alike colours must be to fill together ([ and ] step it). ${DRAG_HINT}`}
            keys="[ ]"
            onChange={(v) => onChange({ ...tool, fillTolerance: v })}
          />
          {opacity}
        </SliderStack>
      </Zone>
    );

  return (
    <Zone label="Brush">
      <div className="flex items-center">
        {SIZE_PRESETS.map((p, i) => {
          const active = tool.size === p.size;
          return (
            <button
              key={p.label}
              type="button"
              title={`${p.size} px`}
              aria-label={`Size ${p.label} (${p.size} px)`}
              aria-pressed={active}
              onClick={() => onChange({ ...tool, size: p.size })}
              className={`grid size-8 place-items-center rounded-lg transition pointer-coarse:size-11 ${active ? 'bg-white shadow-sm ring-2 ring-ink dark:bg-zinc-700 dark:ring-zinc-100' : 'hover:bg-white/70 dark:hover:bg-zinc-700/60'}`}
            >
              <span
                aria-hidden="true"
                className={`rounded-full ${tool.tool === 'eraser' ? 'border-[1.5px] border-dashed border-zinc-500' : 'ring-1 ring-zinc-400/60'}`}
                style={{
                  width: DOTS[i],
                  height: DOTS[i],
                  backgroundColor: tool.tool === 'eraser' ? undefined : tool.color,
                }}
              />
            </button>
          );
        })}
      </div>
      <SliderStack>
        <Slider
          label="Size"
          ariaLabel="Brush size"
          value={tool.size}
          min={MIN_BRUSH_SIZE}
          max={MAX_BRUSH_SIZE}
          display={`${tool.size} px`}
          track={WEDGE}
          hint={`[ and ] step the size, Shift doubles. ${DRAG_HINT}`}
          keys="[ ]"
          onChange={(v) => onChange({ ...tool, size: v })}
        />
        {opacity}
      </SliderStack>
    </Zone>
  );
}
