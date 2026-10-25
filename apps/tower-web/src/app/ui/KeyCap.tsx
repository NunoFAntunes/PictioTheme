import type { ReactNode } from 'react';

/** A keyboard key, for control hints. */
export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded border border-cloud/30 bg-dusk-950/60 px-1.5 py-0.5 font-display text-[0.6875rem] leading-4 [&_svg]:size-3.5 text-cloud shadow-[0_2px_0_oklch(0_0_0/0.35)]">
      {children}
    </kbd>
  );
}
