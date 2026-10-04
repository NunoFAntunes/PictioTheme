import type { DeviceKind } from '@pictiotheme/protocol';

/**
 * Phones are too small to draw on, so they get a "use a tablet or computer" screen instead of a
 * squeezed layout (next-features.md, decided 2026-10-03). A phone is a touch-first device whose
 * screen's shorter side is under 600 CSS px. The screen, not the window: a small desktop window
 * is never a phone. Tablets (iPad mini: 744) pass.
 */
export const PHONE_MAX_SHORT_SIDE = 600;

export function isPhone(device: {
  screenWidth: number;
  screenHeight: number;
  coarsePointer: boolean;
}): boolean {
  return (
    device.coarsePointer && Math.min(device.screenWidth, device.screenHeight) < PHONE_MAX_SHORT_SIDE
  );
}

export function isThisDeviceAPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return isPhone({
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
  });
}

/** How this device is classed for the metrics: touch-first phones and tablets, and the rest. */
export function deviceKind(): DeviceKind {
  if (isThisDeviceAPhone()) return 'phone';
  return window.matchMedia('(pointer: coarse)').matches ? 'tablet' : 'desktop';
}
