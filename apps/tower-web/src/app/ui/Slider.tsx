import { useId } from 'react';

/** A labelled range input with its value shown. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink/80">
        {label}
      </label>
      <output htmlFor={id} className="font-display text-xs tabular-nums text-ink">
        {value.toFixed(decimals)}
        {unit}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="col-span-2 h-2 w-full cursor-pointer accent-safety"
      />
    </div>
  );
}
