import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'sun' | 'soft' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-coral text-cloud [text-shadow:0_2px_0_var(--color-coral-dark)] shadow-[0_5px_0_var(--color-coral-dark)] hover:brightness-105 active:translate-y-[5px] active:shadow-none',
  sun: 'bg-sun text-sun-ink shadow-[0_5px_0_var(--color-sun-dark)] hover:brightness-105 active:translate-y-[5px] active:shadow-none',
  soft: 'bg-card-light text-ink shadow-[0_4px_0_var(--color-card-edge)] hover:bg-card-dark active:translate-y-[4px] active:shadow-none',
  ghost: 'text-current hover:bg-white/15',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Pressed state for toggles (tools, sizes), shown and announced. */
  pressed?: boolean;
};

/**
 * The chunky game button: rounded, with a thick base it presses down into. Clicking never leaves
 * focus on it, so the placement keys (Space especially) go to the tower, not to the last button.
 */
export function Button({ variant = 'soft', pressed, className = '', onMouseUp, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onMouseUp={(e) => {
        e.currentTarget.blur();
        onMouseUp?.(e);
      }}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 font-display text-sm tracking-wide transition select-none disabled:pointer-events-none disabled:opacity-40 pointer-coarse:min-h-11 ${VARIANTS[variant]} ${pressed ? 'ring-3 ring-dusk-700 ring-offset-1 ring-offset-card' : ''} ${className}`}
      {...rest}
    />
  );
}
