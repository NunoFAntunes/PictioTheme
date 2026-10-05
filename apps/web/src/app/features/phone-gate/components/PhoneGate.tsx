import { useEffect, useState, type ReactNode } from 'react';
import { isThisDeviceAPhone } from '../../../lib/device';
import { sendEvent } from '../../../lib/events';

const SKIP_KEY = 'pictiotheme:phone-gate-skipped';

function skippedBefore(): boolean {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * On phones, shows "open this on a tablet or computer" with the current link to copy, instead of
 * the app. The link keeps working, so a player can switch devices and land in the same room.
 * "Try anyway" lets the stubborn through for this tab.
 */
export function PhoneGate({ children }: { children: ReactNode }) {
  const [gated, setGated] = useState(() => isThisDeviceAPhone() && !skippedBefore());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (gated) sendEvent({ name: 'phone_gate', action: 'shown' });
  }, [gated]);
  if (!gated) return children;

  const link = window.location.href;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  function tryAnyway() {
    try {
      sessionStorage.setItem(SKIP_KEY, '1');
    } catch {
      // Private mode: it just won't be remembered.
    }
    sendEvent({ name: 'phone_gate', action: 'bypassed' });
    setGated(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="text-5xl" aria-hidden="true">
        🖍️
      </p>
      <h1 className="text-2xl font-bold">DoodleWhirl! needs a bigger screen</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Drawing on a phone is no fun. Open this link on a tablet or a computer to play.
      </p>
      <p className="w-full rounded-lg bg-zinc-100 px-3 py-2 font-mono text-sm break-all dark:bg-zinc-800">
        {link}
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        className="w-full rounded-full bg-brand-600 px-6 py-3 font-semibold text-white"
      >
        {copied ? '✓ Link copied' : 'Copy link'}
      </button>
      <button type="button" onClick={tryAnyway} className="text-sm text-zinc-500 underline">
        Try anyway
      </button>
    </main>
  );
}
