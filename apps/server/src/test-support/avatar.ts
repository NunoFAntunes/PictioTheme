import { AVATAR_SIZE_PX, DECK_COVER_HEIGHT_PX, DECK_COVER_WIDTH_PX } from '@pictiotheme/protocol';
import { crc32, deflateSync } from 'node:zlib';

/** Builds real PNGs (solid colour) as data URLs, for requests that need a drawn avatar or cover. */

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function testPng(
  rgb: [number, number, number] = [255, 0, 0],
  width = AVATAR_SIZE_PX,
  height = width,
) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array<Buffer>(height).fill(row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function testAvatar(rgb?: [number, number, number], size?: number): string {
  return `data:image/png;base64,${testPng(rgb, size).toString('base64')}`;
}

export function testCover(
  rgb?: [number, number, number],
  width = DECK_COVER_WIDTH_PX,
  height = DECK_COVER_HEIGHT_PX,
): string {
  return `data:image/png;base64,${testPng(rgb, width, height).toString('base64')}`;
}
