/**
 * Picks one of a few options: a sunny block slides along a sunken, outlined track to the chosen
 * one, with a little spring. The options share the width evenly.
 */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onPick,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onPick: (value: T) => void;
  disabled?: boolean;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const count = options.length;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid shrink-0 grid-flow-col auto-cols-fr rounded-xl border-[3px] border-ink bg-card-dark p-0.5 shadow-[inset_0_3px_0_oklch(0.3_0.1_265/0.15),0_3px_0_var(--color-card-edge)]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 rounded-lg border-2 border-ink bg-sun shadow-[0_2px_0_var(--color-sun-dark)] transition-[left] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          width: `calc((100% - 4px) / ${count})`,
          left: `calc(2px + (100% - 4px) * ${index} / ${count})`,
        }}
      />
      {options.map((o) => {
        const picked = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={picked}
            title={o.title}
            disabled={disabled}
            onClick={() => onPick(o.value)}
            className={`relative h-8 px-3 font-display text-xs tracking-wide whitespace-nowrap transition-colors enabled:cursor-pointer disabled:cursor-default ${picked ? 'text-sun-ink' : 'text-ink/55 enabled:hover:text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
