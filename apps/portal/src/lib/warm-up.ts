/**
 * Gets a game ready before the portal leaves for it, so opening it feels like the same page.
 * Pointing at a game prefetches its page; pressing it prerenders the whole thing (scripts, styles,
 * fonts, its first API calls) while its half of the screen grows over the other, then the
 * navigation just swaps it in.
 *
 * Uses the Speculation Rules API where there is one (Chromium). The games live on sibling
 * subdomains, so their pages opt in to being prerendered from here with
 * `Supports-Loading-Mode: credentialed-prerender` (infra/Caddyfile). Elsewhere, a
 * `<link rel="prefetch">` at least fetches the page.
 */

type Level = 'prefetch' | 'prerender';

const done = new Map<string, Level>();

const speculationRules =
  typeof HTMLScriptElement !== 'undefined' &&
  'supports' in HTMLScriptElement &&
  HTMLScriptElement.supports('speculationrules');

export function warmUp(url: string, level: Level): void {
  const before = done.get(url);
  if (before === level || before === 'prerender') return;
  done.set(url, level);

  if (speculationRules) {
    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.textContent = JSON.stringify({
      [level]: [{ source: 'list', urls: [url], eagerness: 'immediate' }],
    });
    document.head.append(script);
    return;
  }
  if (before) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.append(link);
}
