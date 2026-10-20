import type { ReactNode } from 'react';

/** A chunky rounded card floating over the meadow, with an optional title. */
export function Panel({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-panel relative rounded-3xl p-4 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2 px-2">
          {title && (
            <h2 className="font-display text-base tracking-wide text-dusk-800 uppercase">
              {title}
            </h2>
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
