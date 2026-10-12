import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

/**
 * Rasterises SVG to PNG with resvg (WebAssembly, so the server image stays free of native
 * modules). Only the fonts passed in are used, never the system's.
 */

let ready: Promise<void> | null = null;

function initResvg(): Promise<void> {
  ready ??= (async () => {
    const wasm = createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm');
    await initWasm(await readFile(wasm));
  })();
  return ready;
}

export async function renderSvg(
  svg: string,
  font: { buffers: Uint8Array[]; defaultFamily: string } | null = null,
): Promise<Buffer> {
  await initResvg();
  const resvg = new Resvg(svg, {
    font: font
      ? { fontBuffers: font.buffers, loadSystemFonts: false, defaultFontFamily: font.defaultFamily }
      : { loadSystemFonts: false },
  });
  const image = resvg.render();
  const png = Buffer.from(image.asPng());
  image.free();
  resvg.free();
  return png;
}
