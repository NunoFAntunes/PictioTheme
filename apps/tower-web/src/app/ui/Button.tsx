import type { ButtonHTMLAttributes } from 'react';

type Variant = 'safety' | 'hazard' | 'ply' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  safety:
    'bg-safety text-ink shadow-[0_3px_0_var(--color-safety-dark)] hover:brightness-105 active:translate-y-[3px] active:shadow-none',
  hazard:
    'bg-hazard text-ink shadow-[0_3px_0_oklch(0.65_0.15_85)] hover:brightness-105 active:translate-y-[3px] active:shadow-none',
  ply: 'bg-ply-light text-ink shadow-[0_2px_0_var(--color-ply-edge)] hover:bg-ply active:translate-y-[2px] active:shadow-none',
  ghost: 'text-current hover:bg-white/10',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Pressed state for toggles (tools, sizes), shown and announced. */
  pressed?: boolean;
};

/**
 * The building-site button. Clicking never leaves focus on it, so the placement keys
 * (Space especially) go to the tower, not to the last button pressed.
 */
export function Button({ variant = 'ply', pressed, className = '', onMouseUp, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onMouseUp={(e) => {
        e.currentTarget.blur();
        onMouseUp?.(e);
      }}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 font-display text-sm tracking-wide transition select-none disabled:pointer-events-none disabled:opacity-40 pointer-coarse:min-h-11 ${VARIANTS[variant]} ${pressed ? 'ring-3 ring-ink ring-offset-1 ring-offset-ply' : ''} ${className}`}
      {...rest}
    />
  );
}
