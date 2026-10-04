import { describe, expect, it } from 'vitest';
import { pixelToHex } from './sample';

describe('pixelToHex', () => {
  it('reads opaque pixels as they are', () => {
    expect(pixelToHex(220, 38, 38, 255)).toBe('#dc2626');
    expect(pixelToHex(0, 0, 0, 255)).toBe('#000000');
  });

  it('reads blank canvas as the white background', () => {
    expect(pixelToHex(0, 0, 0, 0)).toBe('#ffffff');
  });

  it('blends semi-transparent ink over white, as it looks on screen', () => {
    expect(pixelToHex(0, 0, 0, 128)).toBe('#7f7f7f');
  });
});
