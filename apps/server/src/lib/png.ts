import { createHash } from 'node:crypto';

/** Drawn images (avatars, deck covers) arrive as PNG data URLs and are stored content-addressed. */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Decodes a PNG data URL and checks it is a PNG of the expected size, or returns null. It checks
 * the signature and the IHDR header only: images are served as `image/png` and never decoded by
 * the server.
 */
export function decodePngDataUrl(
  dataUrl: string,
  expected: { width: number; height: number; maxBytes: number },
): Buffer | null {
  const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  if (png.length < 24 || png.length > expected.maxBytes) return null;
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (png.toString('latin1', 12, 16) !== 'IHDR') return null;
  if (png.readUInt32BE(16) !== expected.width || png.readUInt32BE(20) !== expected.height) {
    return null;
  }
  return png;
}

/** The first 32 hex chars of the bytes' sha256: the same image always gets the same id. */
export function contentIdOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 32);
}

/** Response headers for an image served by content id: it never changes, so cache it forever. */
export const IMMUTABLE_PNG_HEADERS = {
  'content-type': 'image/png',
  'cache-control': 'public, max-age=31536000, immutable',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'",
} as const;
