import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Difficulty } from '@pictiotheme/protocol';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFontMetrics, type FontMetrics } from './font-metrics';

/**
 * The room's share card (screens.md §3): the waiting room's card as a 1200×630 picture, for link
 * previews (Discord, Slack, WhatsApp… unfurl an invite link into it, see `shareEmbedHtml`) and
 * "Copy as image". A ticket drawn in ink on ruled paper: the deck's cover on the left, the room's
 * name in the logo's sticker letters, the rules as little stickers, and a tear-off stub with the
 * code. Built as SVG (pure, `shareCardSvg`) and rasterised with resvg (WebAssembly, so the server
 * image stays free of native modules). The background is transparent, so it lies on the chat.
 */

export type ShareCardInput = {
  code: string;
  name: string;
  /** Where to join, e.g. "doodlewhirl.com". */
  host: string;
  deck: { title: string; cover: Buffer | null } | null;
  rounds: number;
  drawSeconds: number;
  difficulties: readonly Difficulty[];
  silly: boolean;
};

export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;

/** Bump when the drawing changes, so cached cards (and chat apps' caches) are redrawn. */
export const SHARE_CARD_REVISION = 1;

// The theme's colours (apps/web/src/styles/global.css), in sRGB.
const INK = '#1f1c31';
const PAPER = '#fcfaf1';
const PAPER_LINE = '#b1d3ec';
const STUB = '#fff3cc';
const SUN = '#ffc921';
const TEAL = '#00beb7';
const POPS = ['#9c5eef', '#fb5b40', SUN, TEAL, '#fe7bb3'];
/** The default deck cover's colours (apps/web/src/app/features/deck-cover/cover-image.ts). */
const DEFAULT_COVER_COLOURS = [
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#9333ea',
];

const LOGO_FONT = 'Cherry Bomb One';
const HAND_FONT = 'Gochi Hand';

export type ShareCardFonts = { logo: FontMetrics; hand: FontMetrics };

type Rand = () => number;
type Pt = readonly [number, number];

/** A small seeded generator (mulberry32 over an FNV hash), so a room's card always wobbles alike. */
function seeded(seed: string): Rand {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v: number) => Math.round(v * 10) / 10;

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * A closed outline through `corners` as a marker would draw it: a point every ~`step` px, each
 * nudged by up to `wobble` px, joined by curves (which also rounds the corners).
 */
function sketchy(corners: readonly Pt[], rand: Rand, wobble = 2.5, step = 70): string {
  const points: Pt[] = [];
  corners.forEach(([x1, y1], i) => {
    const [x2, y2] = corners[(i + 1) % corners.length] ?? [x1, y1];
    const count = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let k = 0; k < count; k++) {
      const t = k / count;
      points.push([
        x1 + (x2 - x1) * t + (rand() - 0.5) * 2 * wobble,
        y1 + (y2 - y1) * t + (rand() - 0.5) * 2 * wobble,
      ]);
    }
  });
  const mid = (a: Pt, b: Pt) => `${n((a[0] + b[0]) / 2)} ${n((a[1] + b[1]) / 2)}`;
  const at = (i: number): Pt => points[(i + points.length) % points.length] ?? [0, 0];
  let d = `M${mid(at(-1), at(0))}`;
  for (let i = 0; i < points.length; i++) {
    d += `Q${n(at(i)[0])} ${n(at(i)[1])} ${mid(at(i), at(i + 1))}`;
  }
  return `${d}Z`;
}

function rect(x: number, y: number, w: number, h: number): Pt[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

/** Ink outline drawn twice, a little apart, like a quick marker sketch. */
function inked(corners: readonly Pt[], rand: Rand, width: number, fill = 'none'): string {
  return [
    `<path d="${sketchy(corners, rand)}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round"/>`,
    `<path d="${sketchy(corners, rand, 3.5)}" fill="none" stroke="${INK}" stroke-width="${n(width * 0.4)}" stroke-linejoin="round" opacity="0.8"/>`,
  ].join('');
}

/** Letters like the logo's: each its own colour, outlined in ink, with a hard ink shadow. */
function stickerText(
  text: string,
  x: number,
  y: number,
  size: number,
  anchor: 'start' | 'middle',
  rand: Rand,
  firstColour = 0,
): string {
  const chars = [...text];
  const rotate = chars.map(() => n((rand() - 0.5) * 10)).join(' ');
  const attrs = `x="${n(x)}" y="${n(y)}" font-family="${LOGO_FONT}" font-size="${n(size)}" text-anchor="${anchor}" letter-spacing="${n(size * 0.03)}" rotate="${rotate}" stroke="${INK}" stroke-width="${n(size * 0.14)}" stroke-linejoin="round"`;
  const coloured = chars
    .map((c, i) => `<tspan fill="${POPS[(i + firstColour) % POPS.length]}">${esc(c)}</tspan>`)
    .join('');
  return [
    `<text ${attrs} fill="${INK}" transform="translate(${n(size * 0.05)} ${n(size * 0.06)})">${esc(text)}</text>`,
    `<text ${attrs} paint-order="stroke">${coloured}</text>`,
  ].join('');
}

/** Shortens `text` with "…" until it fits `maxWidth` at `size`. */
function truncate(text: string, font: FontMetrics, size: number, maxWidth: number): string {
  if (font.measure(text, size) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 1 && font.measure(`${chars.join('').trimEnd()}…`, size) > maxWidth) {
    chars.pop();
  }
  return `${chars.join('').trimEnd()}…`;
}

const NAME_WIDTH = 420;

/** The room's name on one line, or two balanced ones, as big as fits (36 to 86 px). */
export function fitName(name: string, logo: FontMetrics): { lines: string[]; size: number } {
  const width = (text: string) => logo.measure(text, 1, 0.03);
  const single = Math.min(86, NAME_WIDTH / width(name));
  const words = name.split(/\s+/);
  if (single >= 58 || words.length === 1) {
    const size = Math.max(36, single);
    return { lines: [truncate(name, logo, size * 1.03, NAME_WIDTH)], size };
  }
  let best = { lines: [name], widest: Infinity };
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const widest = Math.max(...lines.map(width));
    if (widest < best.widest) best = { lines, widest };
  }
  const size = Math.max(36, Math.min(76, NAME_WIDTH / best.widest));
  return { lines: best.lines.map((l) => truncate(l, logo, size * 1.03, NAME_WIDTH)), size };
}

function rulesOf(input: ShareCardInput): string[] {
  const difficulties = input.difficulties.map((d) => (d[0] ?? '').toUpperCase() + d.slice(1));
  return [
    `${input.rounds} round${input.rounds === 1 ? '' : 's'}`,
    `${input.drawSeconds}s to draw`,
    difficulties.join(' · '),
    ...(input.silly ? ['Silly mode!'] : []),
  ];
}

/** The rules as little stickers, wrapping onto a second row. */
function ruleStickers(
  input: ShareCardInput,
  x: number,
  y: number,
  fonts: ShareCardFonts,
  rand: Rand,
) {
  const size = 29;
  const height = 50;
  let cx = x;
  let cy = y;
  const parts: string[] = [];
  rulesOf(input).forEach((label, i) => {
    const w = fonts.hand.measure(label, size) + 34;
    if (cx + w > x + NAME_WIDTH + 10 && cx > x) {
      cx = x;
      cy += height + 14;
    }
    const tilt = n((rand() - 0.5) * 5);
    const face = sketchy(rect(cx, cy, w, height), rand, 1.5, 40);
    parts.push(
      `<g transform="rotate(${tilt} ${n(cx + w / 2)} ${n(cy + height / 2)})">`,
      `<path d="${face}" fill="${INK}" transform="translate(4 5)"/>`,
      `<path d="${face}" fill="${PAPER}"/>`,
      `<path d="${face}" fill="${POPS[(i + 2) % POPS.length]}" fill-opacity="0.35" stroke="${INK}" stroke-width="3.5"/>`,
      `<text x="${n(cx + w / 2)}" y="${n(cy + height / 2 + 10)}" font-family="${HAND_FONT}" font-size="${size}" text-anchor="middle" fill="${INK}">${esc(label)}</text>`,
      '</g>',
    );
    cx += w + 14;
  });
  return parts.join('');
}

/** The deck's back cover, tilted, with a hard shadow: the drawing, or the default title tile. */
function deckCover(input: ShareCardInput, fonts: ShareCardFonts, rand: Rand): string {
  const [x, y, w, h] = [112, 150, 240, 320];
  const outline = rect(x, y, w, h);
  const parts = [
    `<g transform="rotate(-4 ${x + w / 2} ${y + h / 2})">`,
    `<path d="${sketchy(rect(x + 9, y + 11, w, h), rand)}" fill="${INK}"/>`,
    `<clipPath id="cover"><path d="${sketchy(outline, rand, 1.5)}"/></clipPath>`,
  ];
  const deck = input.deck;
  if (deck?.cover) {
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" clip-path="url(#cover)"/>`,
      `<image href="data:image/png;base64,${deck.cover.toString('base64')}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover)"/>`,
    );
  } else {
    const title = deck?.title ?? 'DoodleWhirl!';
    let hash = 0;
    for (const ch of title) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
    const colour = DEFAULT_COVER_COLOURS[hash % DEFAULT_COVER_COLOURS.length] ?? INK;
    const stripes = Array.from({ length: 30 }, (_, i) => {
      const at = x - h + i * 20;
      return `<path d="M${at} ${y + h}L${at + h} ${y}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="8"/>`;
    }).join('');
    // The title, wrapped onto up to four lines.
    const size = 36;
    const lines: string[] = [];
    for (const word of title.split(/\s+/)) {
      const last = lines.at(-1);
      if (last !== undefined && fonts.hand.measure(`${last} ${word}`, size) <= w - 40) {
        lines[lines.length - 1] = `${last} ${word}`;
      } else lines.push(word);
    }
    const shown = lines.slice(0, 4).map((l) => truncate(l, fonts.hand, size, w - 40));
    const top = y + h / 2 - (shown.length * size * 1.1) / 2 + size * 0.8;
    parts.push(
      `<g clip-path="url(#cover)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colour}"/>${stripes}</g>`,
      ...shown.map(
        (line, i) =>
          `<text x="${x + w / 2}" y="${n(top + i * size * 1.1)}" font-family="${HAND_FONT}" font-size="${size}" text-anchor="middle" fill="#ffffff" stroke="${INK}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(line)}</text>`,
      ),
    );
  }
  parts.push(inked(outline, rand, 5), '</g>');
  return parts.join('');
}

/** A strip of sticky tape with torn ends. */
function tape(cx: number, cy: number, angle: number, colour: string): string {
  const [w, h] = [150, 42];
  const left = cx - w / 2;
  const top = cy - h / 2;
  const torn = (x: number, dir: 1 | -1) =>
    Array.from({ length: 5 }, (_, i) => `${x + (i % 2 ? 6 : 0) * dir} ${n(top + (h / 4) * i)}`);
  const points = [...torn(left, 1), ...torn(left + w, -1).reverse()];
  return `<path d="M${points.join('L')}Z" fill="${colour}" fill-opacity="0.7" transform="rotate(${angle} ${cx} ${cy})"/>`;
}

const TICKET = { left: 52, top: 52, right: 1148, bottom: 572, perforation: 850 } as const;

/** The ticket's outline, with a notch top and bottom where the stub tears off. */
function ticketCorners(): Pt[] {
  const { left, top, right, bottom, perforation: p } = TICKET;
  const notch = (y: number, dir: 1 | -1): Pt[] =>
    [-20, -14, 0, 14, 20].map((dx) => [
      p + dx * dir,
      y + dir * (Math.abs(dx) === 20 ? 0 : Math.abs(dx) === 14 ? 14 : 20),
    ]);
  return [
    [left, top],
    ...notch(top, 1),
    [right, top],
    [right, bottom],
    ...notch(bottom, -1),
    [left, bottom],
  ];
}

export function shareCardSvg(input: ShareCardInput, fonts: ShareCardFonts): string {
  const rand = seeded(`${input.code}:${input.name}`);
  const { left, top, right, bottom, perforation } = TICKET;
  const corners = ticketCorners();
  const outline = sketchy(corners, rand, 2);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">`,
    `<g transform="rotate(-1.2 600 315)">`,
    `<clipPath id="ticket"><path d="${outline}"/></clipPath>`,
    // The hard ink shadow, the paper and its ruled lines, the stub's yellow.
    `<path d="${outline}" fill="${INK}" transform="translate(11 13)"/>`,
    `<path d="${outline}" fill="${PAPER}"/>`,
    `<g clip-path="url(#ticket)">`,
    `<rect x="${perforation}" y="${top - 10}" width="${right - perforation + 10}" height="${bottom - top + 20}" fill="${STUB}"/>`,
    ...Array.from({ length: 11 }, (_, i) => {
      const y = top + 62 + i * 44;
      return `<path d="M${left} ${y}L${perforation - 6} ${n(y + (rand() - 0.5) * 2)}" stroke="${PAPER_LINE}" stroke-width="2" opacity="0.8"/>`;
    }),
    `<path d="M${left + 70} ${top}L${left + 72} ${bottom}" stroke="${POPS[1]}" stroke-width="2" opacity="0.45"/>`,
    `</g>`,
    inked(corners, rand, 5.5),
    // Where the stub tears off.
    `<path d="M${perforation} ${top + 30}L${perforation + 1} ${bottom - 30}" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 16"/>`,
    tape(left + 50, top + 12, -32, SUN),
    tape(right - 40, top + 20, 28, TEAL),
    deckCover(input, fonts, rand),
  ];

  // The name, under a small invitation, with a squiggle under it.
  const textLeft = 405;
  parts.push(
    `<text x="${textLeft}" y="${top + 72}" font-family="${HAND_FONT}" font-size="32" fill="${INK}" fill-opacity="0.7">Come draw &amp; guess with us in</text>`,
  );
  const name = fitName(input.name, fonts.logo);
  let baseline = top + 80 + name.size * 0.95;
  name.lines.forEach((line, i) => {
    parts.push(stickerText(line, textLeft, baseline, name.size, 'start', rand, i * 2));
    if (i < name.lines.length - 1) baseline += name.size * 1.08;
  });
  const nameWidth = Math.min(
    NAME_WIDTH,
    Math.max(...name.lines.map((l) => fonts.logo.measure(l, name.size, name.size * 0.03))),
  );
  const squiggleY = baseline + 22;
  const squiggle = Array.from({ length: 6 }, (_, i) => {
    const x = textLeft + ((i + 0.5) * nameWidth) / 6;
    return `Q${n(x)} ${squiggleY + (i % 2 ? 10 : -10)} ${n(textLeft + ((i + 1) * nameWidth) / 6)} ${squiggleY}`;
  }).join('');
  parts.push(
    `<path d="M${textLeft} ${squiggleY}${squiggle}" fill="none" stroke="${POPS[0]}" stroke-width="6" stroke-linecap="round"/>`,
  );

  // The deck's title, then the rules.
  const deckY = squiggleY + 58;
  if (input.deck) {
    const label = 'Deck:';
    const labelWidth = fonts.hand.measure(label, 30) + 10;
    parts.push(
      `<text x="${textLeft}" y="${deckY}" font-family="${HAND_FONT}" font-size="30" fill="${INK}" fill-opacity="0.7">${label}</text>`,
      `<text x="${n(textLeft + labelWidth)}" y="${deckY}" font-family="${HAND_FONT}" font-size="38" fill="${INK}">${esc(truncate(input.deck.title, fonts.hand, 38, NAME_WIDTH - labelWidth))}</text>`,
    );
  }
  parts.push(ruleStickers(input, textLeft, deckY + 26, fonts, rand));

  // The stub: the code, stacked in sticker letters, and where to enter it.
  const stubCentre = (perforation + right) / 2;
  const [first = input.code, second = ''] = input.code.split('-');
  parts.push(
    `<text x="${stubCentre}" y="${top + 82}" font-family="${HAND_FONT}" font-size="32" text-anchor="middle" fill="${INK}" fill-opacity="0.7">room code</text>`,
    stickerText(first, stubCentre, top + 192, 92, 'middle', rand, 0),
    `<path d="M${stubCentre - 22} ${top + 228}q22 -8 44 0" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
    stickerText(second, stubCentre, top + 335, 92, 'middle', rand, 3),
    `<text x="${stubCentre}" y="${bottom - 92}" font-family="${HAND_FONT}" font-size="30" text-anchor="middle" fill="${INK}" fill-opacity="0.7">join at</text>`,
    `<text x="${stubCentre}" y="${bottom - 50}" font-family="${HAND_FONT}" font-size="${n(Math.min(36, 250 / Math.max(1, fonts.hand.measure(input.host, 1))))}" text-anchor="middle" fill="${INK}">${esc(input.host)}</text>`,
    '</g></svg>',
  );
  return parts.join('');
}

/** Next to this file in development; copied next to the bundle in production (scripts/build.mjs). */
const FONT_FOLDER = new URL('./share-card-fonts/', import.meta.url);

let ready: Promise<{ fonts: ShareCardFonts; buffers: Uint8Array[] }> | null = null;

function prepare() {
  ready ??= (async () => {
    const wasm = createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm');
    await initWasm(await readFile(wasm));
    const logo = readFileSync(fileURLToPath(new URL('CherryBombOne-Regular.ttf', FONT_FOLDER)));
    const hand = readFileSync(fileURLToPath(new URL('GochiHand-Regular.ttf', FONT_FOLDER)));
    return {
      fonts: { logo: readFontMetrics(logo), hand: readFontMetrics(hand) },
      buffers: [new Uint8Array(logo), new Uint8Array(hand)],
    };
  })();
  return ready;
}

/** The share card as a PNG. Takes ~100 ms of CPU: cache the result (RoomRuntime.shareCard). */
export async function renderShareCard(input: ShareCardInput): Promise<Buffer> {
  const { fonts, buffers } = await prepare();
  const resvg = new Resvg(shareCardSvg(input, fonts), {
    font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: HAND_FONT },
  });
  const image = resvg.render();
  const png = Buffer.from(image.asPng());
  image.free();
  resvg.free();
  return png;
}

/** Fonts for tests that build the SVG without rendering it. */
export async function shareCardFonts(): Promise<ShareCardFonts> {
  return (await prepare()).fonts;
}

/**
 * The page a link preview bot gets for an invite link (Caddy sends known bots' `/r/CODE` here):
 * Open Graph tags whose image is the share card. People get the app as usual.
 */
export function shareEmbedHtml(p: {
  origin: string;
  code: string;
  name: string;
  deckTitle: string | null;
  rounds: number;
  imageVersion: string;
}): string {
  const url = `${p.origin}/r/${p.code}`;
  const image = `${p.origin}/api/rooms/${p.code}/card.png?v=${p.imageVersion}`;
  const description = [
    'Come draw and guess with us!',
    ...(p.deckTitle ? [`Deck: ${p.deckTitle}`] : []),
    `${p.rounds} round${p.rounds === 1 ? '' : 's'}`,
    `Room code ${p.code}`,
  ].join(' · ');
  const title = `${p.name} · DoodleWhirl!`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${POPS[0]}">
<meta property="og:site_name" content="DoodleWhirl!">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${SHARE_CARD_WIDTH}">
<meta property="og:image:height" content="${SHARE_CARD_HEIGHT}">
<meta property="og:image:alt" content="${esc(`An invitation to ${p.name}, room code ${p.code}`)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(url)}">
</head>
<body><a href="${esc(url)}">Join ${esc(p.name)} on DoodleWhirl!</a></body>
</html>
`;
}
