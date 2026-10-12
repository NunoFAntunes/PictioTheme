import type { PlayerId } from '@pictiotheme/protocol';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { serverNow, useRoomStore, type PlayedEmote } from '../../../realtime';
import { playSound } from '../../sound';
import { EMOTES } from '../catalog';
import { doodleSvg } from '../doodles';
import { choreograph, type Box, type Motion, type Sprite } from '../choreography';

/** An emote that arrives later than this (a slow tab catching up) is skipped. */
const STALE_MS = 1_500;

/** The figure the stage moves: a wrapper in `PlayerCharacter`, marked with the player's id. */
export const FIGURE_ATTR = 'data-emote-figure';

function figureOf(id: PlayerId): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[${FIGURE_ATTR}]`)) {
    if (el.getAttribute(FIGURE_ATTR) !== id) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function boxOf(el: HTMLElement | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** A blob of tomato with drips, drawn like the rest of the doodles. */
const SPLAT_SVG = `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"><path d="M50 14c7 0 9 10 15 9s12-9 17-3-3 13 1 18 14 3 14 11-11 8-11 14 8 13 2 18-13-2-18 3-3 17-11 17-6-11-12-11-11 9-17 4 1-12-4-16-15 1-16-7 9-9 8-15-11-9-6-16 13-1 18-5 1-14 8-16 6 3 12 1 5-11 10-11z" fill="var(--color-pop-tomato)" stroke="var(--color-ink)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="40" cy="42" r="6" fill="#fff" opacity=".55"/><path d="M38 86q2 9 4 0M62 84q2 12 4 0" stroke="var(--color-ink)" stroke-width="2.5" fill="var(--color-pop-tomato)"/></svg>`;

function spriteElement(sprite: Sprite, actor: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'absolute flex items-center justify-center will-change-transform';
  el.style.left = `${sprite.x - sprite.size / 2}px`;
  el.style.top = `${sprite.y - sprite.size / 2}px`;
  el.style.width = `${sprite.size}px`;
  el.style.height = `${sprite.size}px`;
  switch (sprite.kind) {
    case 'clone': {
      const img = actor.querySelector('img')?.cloneNode() as HTMLImageElement | undefined;
      if (img) {
        img.className = 'size-full object-contain';
        img.removeAttribute('style');
        el.append(img);
      }
      break;
    }
    case 'splat':
      el.innerHTML = SPLAT_SVG;
      break;
    case 'word':
      // As wide as the word, centred on x (`translate` composes with the animated transform).
      el.className +=
        ' whitespace-nowrap font-logo text-pop-tomato [-webkit-text-stroke:1.5px_var(--color-ink)] [text-shadow:2px_2px_0_var(--color-ink)]';
      el.style.removeProperty('width');
      el.style.left = `${sprite.x}px`;
      el.style.translate = '-50% 0';
      el.style.fontSize = `${sprite.size}px`;
      el.textContent = sprite.content ?? '';
      break;
    case 'doodle':
      el.className += ' text-ink';
      if (sprite.doodle) el.innerHTML = doodleSvg(sprite.doodle);
      break;
  }
  return el;
}

function animate(el: Element, m: Motion): Animation {
  return el.animate(m.frames, {
    duration: m.durationMs,
    delay: m.delayMs,
    easing: m.easing ?? 'linear',
    // Sprites stay hidden until their delay is up.
    fill: 'backwards',
  });
}

/** What the stage has going, so it can stop it all when it unmounts. */
type Running = { animations: Set<Animation>; timers: Set<number> };

function play(actorId: PlayerId, emote: PlayedEmote, layer: HTMLElement, running: Running) {
  const actor = figureOf(actorId);
  const target = emote.target ? figureOf(emote.target) : null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const actorBox = boxOf(actor);
  const plan =
    actor && actorBox && !reduced
      ? choreograph(emote.emote, actorBox, boxOf(target), window.innerWidth)
      : null;

  // The sound goes with the hit (straight away for solo emotes, or without the animation).
  const sound = () => playSound(EMOTES[emote.emote].sound);
  if (plan && plan.impactMs > 0) {
    const t = window.setTimeout(() => {
      running.timers.delete(t);
      sound();
    }, plan.impactMs);
    running.timers.add(t);
  } else sound();
  if (!plan || !actor) return;

  const track = (a: Animation, el?: HTMLElement) => {
    running.animations.add(a);
    void a.finished
      .catch(() => undefined)
      .finally(() => {
        running.animations.delete(a);
        el?.remove();
      });
  };
  if (plan.actor) track(animate(actor, plan.actor));
  if (plan.target && target) track(animate(target, plan.target));
  for (const sprite of plan.sprites) {
    const el = spriteElement(sprite, actor);
    if (sprite.kind === 'clone') el.style.transformOrigin = '50% 70%';
    layer.append(el);
    track(animate(el, sprite), el);
  }
}

/**
 * Plays emotes over the whole page (game-rules.md#emotes): the characters in the margin act, and
 * flying clones, tomatoes and comic words cross from one to the other. Portalled, because the
 * players' column scrolls and would clip them. Reduced motion only gets the sound (and the feed).
 */
export function EmoteStage() {
  const emotes = useRoomStore((s) => s.view?.emotes);
  const layer = useRef<HTMLDivElement>(null);
  // Emotes already played, or already over when the stage mounted (nothing replays).
  const seen = useRef<Set<number> | null>(null);
  const running = useRef<Running>({ animations: new Set(), timers: new Set() });

  useEffect(() => {
    const { animations, timers } = running.current;
    return () => {
      for (const a of animations) a.cancel();
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!emotes) return;
    const played = Object.entries(emotes);
    if (!seen.current) {
      seen.current = new Set(played.map(([, e]) => e.id));
      return;
    }
    for (const [actorId, emote] of played) {
      if (seen.current.has(emote.id)) continue;
      seen.current.add(emote.id);
      if (serverNow() - emote.at > STALE_MS) continue;
      if (layer.current) play(actorId, emote, layer.current, running.current);
    }
  });

  return createPortal(
    <div
      ref={layer}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden scheme-light"
    />,
    document.body,
  );
}
