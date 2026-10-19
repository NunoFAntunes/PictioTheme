import type { ReactNode } from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { WOBBLE } from '../../../ui/hand-drawn';
import { playSound } from '../../sound';
import { hasChaosCards } from '../chaos';
import { GAME_STYLES, gameStyleOf, gameStyleSettings } from '../game-styles';
import { useHouseRulesView, type HouseRulesView } from '../house-rules-view';
import { lengthLabel, maxMatchMinutes } from '../match-length';
import { Choices, Group, QuietMarks, RoomSettingsForm } from './RoomSettingsForm';

/**
 * The house rules on the notepad: the simple view (pick one of four ready-made games) or all the
 * rules (RoomSettingsForm), flipped with RulesViewToggle. Each player picks their own side, and
 * the page flips down over the coil when it changes.
 *
 * Both sides are on the pad, one over the other, the one not showing hidden (inert and quiet): the
 * pad is always as tall as its taller side, so flipping never resizes it, nor the deck notebook
 * beside it.
 */
export function HouseRules({ view, editable }: { view: RoomView; editable: boolean }) {
  const side = useHouseRulesView((s) => s.view);
  const pages: Record<HouseRulesView, ReactNode> = {
    simple: <GameStylePicker view={view} editable={editable} />,
    all: <RoomSettingsForm view={view} editable={editable} />,
  };
  return (
    <div className="grid">
      {(['simple', 'all'] as const).map((page) => {
        const shown = page === side;
        return (
          <div
            // A new key when it comes up, so the page flips down again.
            key={shown ? `${page}-shown` : page}
            inert={!shown}
            className={`col-start-1 row-start-1 ${shown ? 'origin-top motion-safe:animate-rules-flip' : 'invisible'}`}
          >
            <QuietMarks value={!shown}>{pages[page]}</QuietMarks>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The four games, circled like the other choices. Settings tuned in all the rules match none of
 * them: then nothing is circled, and the line under them says so.
 */
function GameStylePicker({ view, editable }: { view: RoomView; editable: boolean }) {
  const s = view.settings;
  const chosen = GAME_STYLES.find((style) => style.id === gameStyleOf(s));
  const players = view.players.filter((p) => p.connected).length;
  const chaosReady = hasChaosCards(view.deck);
  const choices = GAME_STYLES.map((style) => ({
    id: style.id,
    label: style.label,
    wild: style.pool === 'chaos',
    note: style.pool === 'chaos' && !chaosReady ? 'needs Chaos cards' : lengthLabel(style.settings),
  }));

  return (
    <Group title="Game">
      <Choices
        label="Game"
        choices={choices}
        value={chosen?.id ?? null}
        editable={editable}
        onChange={(id) => {
          const style = GAME_STYLES.find((x) => x.id === id);
          if (style) sendToRoom({ t: 'room:settings', settings: gameStyleSettings(style) });
        }}
        className="grid grid-cols-2 gap-x-1 gap-y-2"
      />
      <p aria-live="polite" className="min-h-8 text-xs text-zinc-500">
        {chosen
          ? `${chosen.blurb}. Hints, everyone’s guesses and 3 cards to pick from. Up to ~${maxMatchMinutes(s, players)} min with ${Math.max(2, players)} players.`
          : editable
            ? 'Your own house rules: flip to All rules to see them, or pick a game.'
            : 'The host’s own house rules: flip to All rules to see them.'}
      </p>
    </Group>
  );
}

/**
 * The flip between the simple view and all the rules, beside the heading: a doodled switch with
 * a yellow highlighter blob that bounces under the side that's showing.
 */
export function RulesViewToggle() {
  const side = useHouseRulesView((s) => s.view);
  const flip = useHouseRulesView((s) => s.flip);
  const all = side === 'all';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={all}
      aria-label="All rules"
      title={all ? 'Back to the simple games' : 'See and change every rule'}
      onClick={() => {
        flip();
        playSound('pageTurn');
      }}
      className={`group relative inline-grid shrink-0 grid-cols-2 items-center ${WOBBLE[2]} border-[2px_2.5px_3px_2px] border-ink bg-paper p-0.5 font-hand text-base leading-none text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:-rotate-2 hover:shadow-[3px_3px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ink focus-visible:outline-dashed active:translate-y-0 active:shadow-none pointer-coarse:min-h-11`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] ${WOBBLE[1]} bg-pop-sun/80 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${all ? 'translate-x-full' : ''}`}
      />
      <Side icon="🎈" label="Simple" on={!all} />
      <Side icon="🔧" label="All rules" on={all} />
    </button>
  );
}

function Side({ icon, label, on }: { icon: string; label: string; on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex items-center justify-center gap-1 px-2 py-1 whitespace-nowrap transition duration-300 ${on ? '' : 'opacity-50'}`}
    >
      <span
        className={`inline-block transition-transform duration-300 ${on ? '-rotate-12 scale-125' : 'grayscale'}`}
      >
        {icon}
      </span>
      {label}
    </span>
  );
}
