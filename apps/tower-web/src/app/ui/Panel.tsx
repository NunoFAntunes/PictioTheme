import type { ReactNode } from 'react';

function Screw({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute size-2.5 rounded-full bg-screw shadow-[inset_0_1px_1px_oklch(1_0_0/0.5),0_1px_0_oklch(0_0_0/0.25)] before:absolute before:top-1/2 before:left-[2px] before:h-px before:w-1.5 before:-translate-y-1/2 before:rotate-45 before:bg-steel-dark ${className}`}
    />
  );
}

/** A plywood panel screwed to the blueprint, with an optional stencilled title. */
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
    <section className={`plywood relative rounded-lg p-4 ${className}`}>
      <Screw className="top-2 left-2" />
      <Screw className="top-2 right-2" />
      <Screw className="bottom-2 left-2" />
      <Screw className="right-2 bottom-2" />
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2 px-2">
          {title && (
            <h2 className="font-display text-sm tracking-widest text-ink/75 uppercase">{title}</h2>
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
