import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LINE_HEIGHTS, type LineHeight } from '@pictiotheme/protocol/tower';
import { readFontMetrics, type FontMetrics } from '../../lib/font-metrics';
import { renderSvg } from '../../lib/svg';

/**
 * Doodle Tower's share card: a 1200×630 picture of a room's invite, for link previews (Discord,
 * Slack, WhatsApp… unfurl an invite link into it, see `towerShareEmbedHtml`) and "Copy the card".
 * In the "Sunny meadow" look (docs/tower/design/visual-identity.md), nothing of DoodleWhirl's:
 * a sky with the sun and clouds, rolling hills, two block towers on their plinths racing up to the
 * bunting, and a white card with the room's name, its rules and the code. Built as SVG (pure,
 * `towerShareCardSvg`) and rasterised with resvg, like DoodleWhirl's (rooms/share-card.ts).
 */

export type TowerShareCardInput = {
  code: string;
  /** "Ana's tower". */
  name: string;
  /** Where to join, e.g. "doodletower.com". */
  host: string;
  line: LineHeight;
  roundSeconds: number;
  steals: boolean;
};

export const TOWER_SHARE_CARD_WIDTH = 1200;
export const TOWER_SHARE_CARD_HEIGHT = 630;

/** Bump when the drawing changes, so cached cards (and chat apps' caches) are redrawn. */
export const TOWER_SHARE_CARD_REVISION = 1;

// The tokens (apps/tower-web/src/styles/global.css), in sRGB.
const DUSK_950 = '#1d1a5a';
const DUSK_900 = '#242976';
const DUSK_800 = '#2d3f9a';
const SKY = '#3da7ed';
const SKY_LIGHT = '#b7f0fe';
const GRASS = '#67cd4f';
const GRASS_DARK = '#279936';
const CARD = '#fcfaf1';
const CARD_EDGE = '#abbee5';
const SUN = '#fccf28';
const SUN_DARK = '#da950b';
const CORAL = '#ff7333';
const CREW_ORANGE = '#ff7f16';
const CREW_TEAL = '#00bec7';
const INK = '#1c214d';
const PEBBLE = '#9aa5b8';
const PEBBLE_DARK = '#5b6986';
const CLOUD = '#fbfeff';
const BLOCKS = [CREW_ORANGE, CREW_TEAL, SUN, CORAL, GRASS, '#b58cff', '#ff8fc2'];

const FONT = 'Lilita One';

type Rand = () => number;

/** A small seeded generator (mulberry32 over an FNV hash), so a room's card always looks alike. */
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

/** Shortens `text` with "…" until it fits `maxWidth` at `size`. */
function truncate(text: string, font: FontMetrics, size: number, maxWidth: number): string {
  if (font.measure(text, size) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 1 && font.measure(`${chars.join('').trimEnd()}…`, size) > maxWidth) {
    chars.pop();
  }
  return `${chars.join('').trimEnd()}…`;
}

/** White letters with a dark outline and a hard shadow under them, like the site's titles. */
function titleText(text: string, x: number, y: number, size: number, fill = CLOUD): string {
  const attrs = `x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-size="${n(size)}" letter-spacing="${n(size * 0.02)}" stroke="${DUSK_950}" stroke-width="${n(size * 0.16)}" stroke-linejoin="round" paint-order="stroke"`;
  return [
    `<text ${attrs} fill="${DUSK_950}" transform="translate(0 ${n(size * 0.08)})">${esc(text)}</text>`,
    `<text ${attrs} fill="${fill}">${esc(text)}</text>`,
  ].join('');
}

/** A puffy cloud: a few overlapping circles on a flat base. */
function cloud(cx: number, cy: number, scale: number, rand: Rand): string {
  const puffs = [
    [-60, 0, 30],
    [-25, -18, 38],
    [20, -10, 34],
    [55, 2, 26],
  ].map(
    ([dx = 0, dy = 0, r = 0]) =>
      `<circle cx="${n(cx + dx * scale)}" cy="${n(cy + dy * scale + (rand() - 0.5) * 6)}" r="${n(r * scale)}"/>`,
  );
  const base = `<rect x="${n(cx - 85 * scale)}" y="${n(cy)}" width="${n(170 * scale)}" height="${n(26 * scale)}" rx="${n(13 * scale)}"/>`;
  return `<g fill="${CLOUD}" opacity="0.95">${puffs.join('')}${base}</g>`;
}

/** The sun, top right of the sky, with soft rays. */
function sun(cx: number, cy: number): string {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const [x1, y1] = [cx + Math.cos(a) * 72, cy + Math.sin(a) * 72];
    const [x2, y2] = [cx + Math.cos(a) * 100, cy + Math.sin(a) * 100];
    return `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" stroke="${SUN}" stroke-width="12" stroke-linecap="round" opacity="0.7"/>`;
  });
  return [
    ...rays,
    `<circle cx="${cx}" cy="${cy}" r="62" fill="${SUN}" stroke="${SUN_DARK}" stroke-width="6"/>`,
  ].join('');
}

/** A tower of chunky blocks on a grassy stone plinth, its top at about `topY`. */
function tower(cx: number, groundY: number, topY: number, crew: string, rand: Rand): string {
  const parts: string[] = [];
  const plinth = { w: 170, h: 46 };
  const px = cx - plinth.w / 2;
  const py = groundY - plinth.h;
  parts.push(
    `<rect x="${px}" y="${py}" width="${plinth.w}" height="${plinth.h}" rx="10" fill="${PEBBLE}" stroke="${INK}" stroke-width="5"/>`,
    `<path d="M${px + 20} ${py + 22}h40M${px + 85} ${py + 30}h55" stroke="${PEBBLE_DARK}" stroke-width="5" stroke-linecap="round"/>`,
    `<rect x="${px - 6}" y="${py - 10}" width="${plinth.w + 12}" height="20" rx="10" fill="${GRASS}" stroke="${INK}" stroke-width="5"/>`,
  );
  // Blocks, bottom up, each a little off centre and tilted, until the tower reaches `topY`.
  let y = py - 10;
  let i = 0;
  while (y > topY + 30) {
    const w = 70 + rand() * 70;
    const h = Math.min(y - topY, 34 + rand() * 30);
    const x = cx - w / 2 + (rand() - 0.5) * 30;
    const tilt = n((rand() - 0.5) * 8);
    const fill = i === 0 ? crew : (BLOCKS[Math.floor(rand() * BLOCKS.length)] ?? crew);
    parts.push(
      `<g transform="rotate(${tilt} ${n(x + w / 2)} ${n(y - h / 2)})">`,
      `<rect x="${n(x + 4)}" y="${n(y - h + 6)}" width="${n(w)}" height="${n(h)}" rx="12" fill="${INK}" opacity="0.25"/>`,
      `<rect x="${n(x)}" y="${n(y - h)}" width="${n(w)}" height="${n(h)}" rx="12" fill="${fill}" stroke="${INK}" stroke-width="5"/>`,
      `<path d="M${n(x + 12)} ${n(y - h + 12)}h${n(w * 0.35)}" stroke="${CLOUD}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`,
      '</g>',
    );
    y -= h - 2;
    i++;
  }
  return parts.join('');
}

/** A string of bunting across the sky: the height line, with its "TOP OUT" tag. */
function bunting(x1: number, x2: number, y: number): string {
  const count = Math.round((x2 - x1) / 38);
  const step = (x2 - x1) / count;
  const sag = (x: number) => y + Math.sin(((x - x1) / (x2 - x1)) * Math.PI) * 14;
  const flags = Array.from({ length: count }, (_, i) => {
    const a = x1 + i * step + 4;
    const b = a + step - 8;
    const mid = (a + b) / 2;
    const colour = i % 2 ? CORAL : SUN;
    return `<path d="M${n(a)} ${n(sag(a))}L${n(b)} ${n(sag(b))}L${n(mid)} ${n(sag(mid) + 30)}Z" fill="${colour}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  });
  const curve = `M${x1} ${y}Q${(x1 + x2) / 2} ${y + 28} ${x2} ${y}`;
  const tagX = x2 - 64;
  return [
    `<path d="${curve}" fill="none" stroke="${INK}" stroke-width="3"/>`,
    ...flags,
    `<rect x="${tagX}" y="${y - 44}" width="96" height="34" rx="10" fill="${CLOUD}" stroke="${INK}" stroke-width="4"/>`,
    `<text x="${tagX + 48}" y="${y - 18}" font-family="${FONT}" font-size="22" text-anchor="middle" fill="${DUSK_900}">TOP OUT</text>`,
  ].join('');
}

/** A rule as a dusk pill with white letters. Returns its width too, to line them up. */
function chip(label: string, x: number, y: number, font: FontMetrics): [string, number] {
  const size = 26;
  const w = font.measure(label, size) + 36;
  return [
    [
      `<rect x="${n(x)}" y="${y + 5}" width="${n(w)}" height="46" rx="23" fill="${DUSK_950}"/>`,
      `<rect x="${n(x)}" y="${y}" width="${n(w)}" height="46" rx="23" fill="${DUSK_900}"/>`,
      `<text x="${n(x + w / 2)}" y="${y + 32}" font-family="${FONT}" font-size="${size}" text-anchor="middle" fill="${CLOUD}">${esc(label)}</text>`,
    ].join(''),
    w,
  ];
}

function rulesOf(input: TowerShareCardInput): string[] {
  return [
    `Line ${LINE_HEIGHTS[input.line]} m`,
    `${input.roundSeconds}s to draw`,
    input.steals ? 'Steals on' : 'No steals',
  ];
}

const PANEL = { x: 520, y: 132, w: 630, h: 400 } as const;
const PANEL_TEXT_WIDTH = PANEL.w - 80;

export function towerShareCardSvg(input: TowerShareCardInput, font: FontMetrics): string {
  const rand = seeded(`${input.code}:${input.name}`);
  const W = TOWER_SHARE_CARD_WIDTH;
  const H = TOWER_SHARE_CARD_HEIGHT;
  const ground = 560;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY}"/><stop offset="1" stop-color="${SKY_LIGHT}"/></linearGradient>`,
    `<clipPath id="scene"><rect width="${W}" height="${H}" rx="40"/></clipPath></defs>`,
    `<g clip-path="url(#scene)">`,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>`,
    sun(1090, 70),
    cloud(470, 70, 0.8, rand),
    cloud(860, 105, 0.6, rand),
    cloud(120, 330, 0.55, rand),
    // The hills, far then near.
    `<path d="M0 470Q180 400 380 450T800 430T1200 450V${H}H0Z" fill="${GRASS_DARK}"/>`,
    `<path d="M0 520Q260 470 520 510T1200 500V${H}H0Z" fill="${GRASS}"/>`,
    `<rect y="${ground}" width="${W}" height="${H - ground}" fill="${GRASS}"/>`,
    bunting(60, 470, 228),
    tower(150, ground, 215 + rand() * 40, CREW_ORANGE, rand),
    tower(370, ground, 250 + rand() * 60, CREW_TEAL, rand),
  ];

  // The game's name, top left, straight on the sky.
  parts.push(
    titleText('Doodle', 56, 104, 78),
    titleText('Tower', 56 + font.measure('Doodle ', 78, 78 * 0.02), 104, 78, SUN),
  );

  // The invite card, with its thick base, like the site's panels.
  const { x, y, w, h } = PANEL;
  parts.push(
    `<rect x="${x}" y="${y + 18}" width="${w}" height="${h}" rx="36" fill="${DUSK_950}" opacity="0.25"/>`,
    `<rect x="${x}" y="${y + 10}" width="${w}" height="${h}" rx="36" fill="${CARD_EDGE}"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="36" fill="${CARD}"/>`,
    `<text x="${x + 40}" y="${y + 62}" font-family="${FONT}" font-size="30" fill="${DUSK_800}">Come build a tower with us in</text>`,
  );
  const nameSize = Math.max(40, Math.min(70, PANEL_TEXT_WIDTH / font.measure(input.name, 1, 0.02)));
  const name = truncate(input.name, font, nameSize * 1.02, PANEL_TEXT_WIDTH);
  parts.push(titleText(name, x + 40, y + 76 + nameSize * 0.9, nameSize));

  let cx = x + 40;
  for (const label of rulesOf(input)) {
    const [svg, cw] = chip(label, cx, y + 178, font);
    parts.push(svg);
    cx += cw + 14;
  }

  // The code on a sunny tag, and where to join.
  const tag = { x: x + 40, y: y + 262, h: 100 };
  const codeSize = 64;
  const tagW = font.measure(input.code, codeSize, codeSize * 0.08) + 64;
  parts.push(
    `<rect x="${tag.x}" y="${tag.y + 8}" width="${n(tagW)}" height="${tag.h}" rx="24" fill="${SUN_DARK}"/>`,
    `<rect x="${tag.x}" y="${tag.y}" width="${n(tagW)}" height="${tag.h}" rx="24" fill="${SUN}"/>`,
    `<text x="${n(tag.x + tagW / 2)}" y="${tag.y + 73}" font-family="${FONT}" font-size="${codeSize}" letter-spacing="${n(codeSize * 0.08)}" text-anchor="middle" fill="${INK}">${esc(input.code)}</text>`,
  );
  const hostX = tag.x + tagW + 26;
  const hostWidth = x + w - 36 - hostX;
  const hostSize = Math.min(30, hostWidth / Math.max(1, font.measure(input.host, 1)));
  parts.push(
    `<text x="${n(hostX)}" y="${tag.y + 42}" font-family="${FONT}" font-size="26" fill="${DUSK_800}">join at</text>`,
    `<text x="${n(hostX)}" y="${tag.y + 80}" font-family="${FONT}" font-size="${n(hostSize)}" fill="${DUSK_900}">${esc(input.host)}</text>`,
    '</g></svg>',
  );
  return parts.join('');
}

/** Next to this file in development; copied next to the bundle in production (scripts/build.mjs). */
const FONT_FOLDER = new URL('./tower-share-card-fonts/', import.meta.url);

let ready: Promise<{ font: FontMetrics; buffers: Uint8Array[] }> | null = null;

function prepare() {
  ready ??= (async () => {
    const ttf = readFileSync(fileURLToPath(new URL('LilitaOne-Regular.ttf', FONT_FOLDER)));
    return { font: readFontMetrics(ttf), buffers: [new Uint8Array(ttf)] };
  })();
  return ready;
}

/** The share card as a PNG. Takes ~100 ms of CPU: cache the result (TowerRoomRuntime.shareCard). */
export async function renderTowerShareCard(input: TowerShareCardInput): Promise<Buffer> {
  const { font, buffers } = await prepare();
  return renderSvg(towerShareCardSvg(input, font), { buffers, defaultFamily: FONT });
}

/** The font, for tests that build the SVG without rendering it. */
export async function towerShareCardFont(): Promise<FontMetrics> {
  return (await prepare()).font;
}

/**
 * The page a link preview bot gets for an invite link (Caddy sends known bots' `/r/CODE` here):
 * Open Graph tags whose image is the share card. People get the site as usual.
 */
export function towerShareEmbedHtml(p: {
  origin: string;
  code: string;
  name: string;
  line: LineHeight;
  imageVersion: string;
}): string {
  const url = `${p.origin}/r/${p.code}`;
  const image = `${p.origin}/api/tower/rooms/${p.code}/card.png?v=${p.imageVersion}`;
  const description = [
    'Two crews, one drawing at a time: come build a tower with us!',
    `Line at ${LINE_HEIGHTS[p.line]} m`,
    `Room code ${p.code}`,
  ].join(' · ');
  const title = `${p.name} · Doodle Tower`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${CORAL}">
<meta property="og:site_name" content="Doodle Tower">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${TOWER_SHARE_CARD_WIDTH}">
<meta property="og:image:height" content="${TOWER_SHARE_CARD_HEIGHT}">
<meta property="og:image:alt" content="${esc(`An invitation to ${p.name}, room code ${p.code}`)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(url)}">
</head>
<body><a href="${esc(url)}">Join ${esc(p.name)} on Doodle Tower</a></body>
</html>
`;
}
