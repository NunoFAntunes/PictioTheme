import { useEffect, useState } from 'react';
import { serverNow } from './room-store';

/** The server's clock, re-rendering every `intervalMs` (for countdowns: rule W7). */
export function useServerNow(intervalMs = 250): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
