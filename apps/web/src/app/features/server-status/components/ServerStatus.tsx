import { useServerReady } from '../api';

export function ServerStatus() {
  const { isPending, isSuccess } = useServerReady();
  const [dot, label] = isPending
    ? ['bg-zinc-400', 'Connecting…']
    : isSuccess
      ? ['bg-solved', 'Server online']
      : ['bg-close', 'Server unavailable'];

  return (
    <p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </p>
  );
}
