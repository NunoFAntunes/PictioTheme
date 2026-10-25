import { makePiece, type ShapeResult } from '@pictiotheme/doodle-shape';
import type { Team } from '@pictiotheme/protocol/tower';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { uiScale } from '../../../lib/ui-scale';
import { strokeModels, useServerNow, type RoomView } from '../../../realtime';
import { CREW_NAME, CREW_TEXT } from '../../../ui/CrewBadge';
import { stageAnchor, useStageAnchor } from '../../crew-stage';
import { DrawingBoard, type DrawSettings } from '../../drawing';

/** The drawer's live block: recomputed a moment after the drawing changes. */
export function useLivePiece(team: Team, enabled: boolean): ShapeResult | null {
  const [shape, setShape] = useState<ShapeResult | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const model = strokeModels[team];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      timer ??= setTimeout(() => {
        timer = undefined;
        setShape(makePiece(model.strokes));
      }, delay);
    };
    schedule(0);
    const unsubscribe = model.subscribe(() => schedule(120));
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [team, enabled]);
  return enabled ? shape : null;
}

/**
 * The clipboard around the board, in CSS px (see DrawingBoard): its border is 4px, its padding is
 * in rem, which grows on big screens (`uiScale`).
 */
const clipboardX = () => 8 + 24 * uiScale();
const clipboardY = () => 8 + 36 * uiScale();
/** From the clipboard's top edge to the paper (its border and top padding). */
const clipboardTop = () => 4 + 24 * uiScale();
/** Half the clip's width, and a little air either side of it. */
const clipHalf = () => 62 * uiScale();

/**
 * Where your crew stands on its clipboard (docs/tower/design/screens.md#the-crews-on-stage): the
 * drawer in the bottom right corner, the guessers along the top either side of the clip, peeking
 * over the paper. None while the clipboard is `covered` (by your own decide card).
 */
function useClipboardAnchors(team: Team, covered: boolean) {
  const board = useRef<HTMLDivElement>(null);
  useStageAnchor(stageAnchor.pad(team), () => {
    const r = board.current?.getBoundingClientRect();
    if (covered || !r?.width) return null;
    const u = uiScale();
    const size = 52 * u;
    const x = r.right - 14 * u - size / 2;
    return { left: x, right: x, y: r.bottom - 6 * u, size };
  });
  useStageAnchor(stageAnchor.rim(team), () => {
    const r = board.current?.getBoundingClientRect();
    if (covered || !r?.width) return null;
    const middle = (r.left + r.right) / 2;
    const u = uiScale();
    return {
      left: r.left + 14 * u,
      right: r.right - 14 * u,
      y: r.top + clipboardTop() + 6 * u,
      size: 40 * u,
      gap: { left: middle - clipHalf(), right: middle + clipHalf() },
    };
  });
  // The drawing itself, where a golden word's spell starts from: there even when covered.
  useStageAnchor(stageAnchor.board(team), () => {
    const r = board.current?.getBoundingClientRect();
    if (!r?.width) return null;
    const x = (r.left + r.right) / 2;
    return { left: x, right: x, y: (r.top + r.bottom) / 2, size: 52 * uiScale() };
  });
  return board;
}

/**
 * The board's width in `column` (a flex column, with the board in a `data-board` box): as wide as
 * the column, unless that would push what's under it off the bottom, then as tall as the space
 * left. Whatever stays free ends up under the column's last item, not between the board and it.
 */
export function useBoardWidth(column: RefObject<HTMLElement | null>): number | undefined {
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const col = column.current;
    if (!col) return;
    const fit = () => {
      const board = col.querySelector<HTMLElement>('[data-board]');
      if (!board) return;
      const items = [...col.children].filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && getComputedStyle(el).position !== 'absolute',
      );
      const gap = parseFloat(getComputedStyle(col).rowGap) || 0;
      const used = items.reduce((sum, el) => sum + el.offsetHeight, 0) + gap * (items.length - 1);
      const height = board.offsetHeight + col.clientHeight - used;
      const next = Math.floor(
        Math.max(160, Math.min(col.clientWidth, ((height - clipboardY()) * 4) / 3 + clipboardX())),
      );
      setWidth((w) => (w === next ? w : next));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(col);
    for (const el of col.children) observer.observe(el);
    const mutations = new MutationObserver(() => {
      for (const el of col.children) observer.observe(el);
      fit();
    });
    mutations.observe(col, { childList: true });
    fit();
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [column]);
  return width;
}

/**
 * Your crew's drawing, with what you may know about it: the word for its drawer, the letter mask
 * for the rest of the crew (once the first hint is due), and the time left. The board is as big
 * as the middle column allows, in width and in height.
 */
export function DrawingStage({
  view,
  team,
  settings,
  shape,
  onOp,
  boardWidth,
  covered = false,
}: {
  view: RoomView;
  /** Your crew. */
  team: Team;
  /** The drawer's tools, when it's your drawing. */
  settings: DrawSettings;
  shape: ShapeResult | null;
  onOp?: Parameters<typeof DrawingBoard>[0]['onOp'];
  /** From useBoardWidth; the column's whole width until it's measured. */
  boardWidth?: number;
  /** Something's over it (your decide card): your crew isn't shown on it. */
  covered?: boolean;
}) {
  const now = useServerNow();
  const round = view.crews[team].round;
  const drawing = round?.drawerId === view.you;
  const drawer = round ? view.players.find((p) => p.id === round.drawerId) : null;
  const secondsLeft = round ? Math.max(0, Math.ceil((round.endsAt - now) / 1000)) : 0;

  let clue: { text: string; dim: boolean };
  if (!round) clue = { text: 'Next drawing…', dim: true };
  else if (drawing) clue = { text: round.word ?? '', dim: false };
  else if (round.mask) clue = { text: round.mask, dim: false };
  else clue = { text: 'Hint soon…', dim: true };
  // A golden word: solving it gives the crew a spell (docs/tower/planning/power-ups.md).
  const golden = round?.golden ?? false;
  const spell = view.crews[team].spell;
  const shaky = spell?.spell === 'shaky' && now >= spell.startsAt && now < spell.endsAt;
  const board = useClipboardAnchors(team, covered);

  return (
    <section
      aria-label={`${CREW_NAME[team]} crew's drawing`}
      className="flex min-w-0 shrink-0 flex-col items-center gap-3"
      data-testid={`stage-${team}`}
    >
      <header
        className={`flex w-full items-end gap-3 rounded-2xl bg-dusk-900 px-3 py-1.5 shadow-[0_4px_0_var(--color-dusk-950)] ${golden ? 'ring-2 ring-sun' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <div className={`truncate font-display text-xs tracking-widest ${CREW_TEXT[team]}`}>
            {drawing ? 'YOU’RE DRAWING' : 'YOUR CREW'}
            {drawer && !drawing && (
              <span className="ml-2 text-cloud-dim normal-case">{drawer.name} is drawing</span>
            )}
            {shaky && (
              <span
                className="ml-2 animate-pulse rounded bg-coral px-1 text-cloud"
                title="The other crew cast Shaky hand: new lines wobble"
              >
                〰️ SHAKY HAND
              </span>
            )}
            {golden && (
              <span
                className="ml-2 rounded bg-sun px-1 text-ink"
                title="Solve it for a spell as well as the piece"
              >
                ✨ GOLDEN
              </span>
            )}
          </div>
          <div
            className={`truncate font-display leading-tight tracking-[0.15em] ${clue.dim ? 'text-lg text-cloud-dim' : 'text-2xl'}`}
            data-testid={drawing ? 'word' : 'mask'}
          >
            {clue.text}
          </div>
        </div>
        {round && (
          <div
            className={`font-display text-2xl tabular-nums ${secondsLeft <= 10 ? 'text-sun' : ''}`}
            role="timer"
          >
            {secondsLeft}
          </div>
        )}
      </header>

      <div
        ref={board}
        data-board
        className={`max-w-full ${golden ? 'rounded-[1.4rem] shadow-[0_0_0_4px_var(--color-sun),0_0_28px_var(--color-sun)]' : ''}`}
        style={{ width: boardWidth ?? '100%' }}
      >
        <DrawingBoard
          model={strokeModels[team]}
          settings={settings}
          preview={shape?.preview ?? null}
          showSilhouette={drawing}
          disabled={!drawing}
          onOp={onOp}
          label={drawing ? 'Your drawing' : `${CREW_NAME[team]} crew's drawing`}
        />
      </div>
    </section>
  );
}
