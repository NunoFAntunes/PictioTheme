import type { ReactNode } from 'react';

/** The picture's frame on a guide page: a patch of sky, hidden from screen readers. */
export function Art({
  children,
  className = '',
  bare = false,
}: {
  children: ReactNode;
  className?: string;
  /** No padding: a picture that fills the frame. */
  bare?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-64 min-w-0 items-center justify-center gap-2 rounded-2xl bg-sky-light/70 ${bare ? 'overflow-hidden' : 'p-3 sm:gap-3 sm:p-4'} ${className}`}
    >
      {children}
    </div>
  );
}
