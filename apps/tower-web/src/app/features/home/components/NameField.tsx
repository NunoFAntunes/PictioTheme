import { useId } from 'react';

/** The player's name: shown to everyone in the room, 2–20 characters. */
export function NameField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-ink/75">
        Your name
      </label>
      <input
        id={id}
        value={value}
        maxLength={20}
        autoComplete="nickname"
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Captain Doodle"
        className="h-11 w-full rounded-xl border-2 border-ink/15 bg-paper px-3 text-lg font-medium text-ink outline-none focus:border-coral"
      />
    </div>
  );
}
