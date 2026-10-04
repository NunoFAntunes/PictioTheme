import { useEffect, useRef } from 'react';

type Props = {
  value: string;
  /** Every move in the native picker: preview the colour without adding it to the recent list. */
  onLive: (color: string) => void;
  /** The picker closed on a colour. */
  onCommit: (color: string) => void;
  className?: string;
};

/**
 * The native colour picker. React's `onChange` fires on every `input` event while the picker is
 * open; the native `change` event fires once when it closes, which is when the colour counts as
 * picked (it joins the recent colours and becomes the one `X` swaps back to).
 */
export function CustomColorInput({ value, onLive, onCommit, className }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const commit = () => onCommitRef.current(input.value);
    input.addEventListener('change', commit);
    return () => input.removeEventListener('change', commit);
  }, []);

  return (
    <input
      ref={ref}
      type="color"
      value={value}
      onChange={(e) => onLive(e.target.value)}
      className={className}
    />
  );
}
