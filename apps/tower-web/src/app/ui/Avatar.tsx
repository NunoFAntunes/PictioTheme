/** A player's avatar (stored by the server, cached forever by id), `size` px at a 16px rem. */
export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return (
    <img
      src={`/api/avatars/${id}`}
      alt={`${name}'s avatar`}
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-cloud/10"
      // In rem, so it grows with the page on big screens.
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
    />
  );
}
