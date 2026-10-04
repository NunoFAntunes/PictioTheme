import type { AvatarId } from '@pictiotheme/protocol';

/** A player's drawn avatar, from the server by id or from a local data URL (your own). */

const SIZES = {
  sm: 'size-8 rounded-lg',
  md: 'size-10 rounded-lg',
  lg: 'size-16 rounded-xl',
  xl: 'size-24 rounded-2xl',
} as const;

export function avatarUrl(id: AvatarId): string {
  return `/api/avatars/${id}`;
}

type Props = { size?: keyof typeof SIZES; alt?: string } & (
  { id: AvatarId; src?: never } | { src: string; id?: never }
);

export function Avatar({ id, src, size = 'md', alt = '' }: Props) {
  return (
    <img
      src={id ? avatarUrl(id) : src}
      alt={alt}
      draggable={false}
      className={`shrink-0 border border-zinc-200 bg-white object-cover dark:border-zinc-700 ${SIZES[size]}`}
    />
  );
}
