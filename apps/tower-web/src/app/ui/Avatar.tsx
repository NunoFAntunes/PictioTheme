/** A player's avatar (stored by the server, cached forever by id). */
export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return (
    <img
      src={`/api/avatars/${id}`}
      alt={`${name}'s avatar`}
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-cloud/10"
      style={{ width: size, height: size }}
    />
  );
}
