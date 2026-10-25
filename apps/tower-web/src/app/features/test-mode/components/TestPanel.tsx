import {
  CURSES,
  SPELL_TUNING,
  SPELLS,
  type Team,
  type TestAction,
} from '@pictiotheme/protocol/tower';
import { useState, type ReactNode } from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { CURSE_LABEL } from '../../../lib/curses';
import { SPELL_LABEL } from '../../../lib/spells';
import { Button } from '../../../ui/Button';
import { CREW_NAME } from '../../../ui/CrewBadge';
import { CHECK_COUNT, CHECKLIST, useTestMode } from '../checklist';

const act = (action: TestAction) => sendToRoom({ t: 'test', action });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-display text-xs tracking-wider text-dusk-800 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Small(props: Parameters<typeof Button>[0]) {
  return <Button {...props} className={`h-8 min-h-8 px-2 text-xs ${props.className ?? ''}`} />;
}

/** The curse the next piece gets, whoever solves it. */
function CursePicker() {
  const { curse, setCurse } = useTestMode();
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Next piece's curse">
      <Small pressed={curse === null} onClick={() => setCurse(null)} title="Rolled, as in a match">
        🎲 Random
      </Small>
      {CURSES.map((c) => (
        <Small
          key={c}
          pressed={curse === c}
          onClick={() => setCurse(c)}
          title={CURSE_LABEL[c].effect}
        >
          {CURSE_LABEL[c].icon} {CURSE_LABEL[c].name}
        </Small>
      ))}
    </div>
  );
}

function RivalControls({ view, rival }: { view: RoomView; rival: Team }) {
  const curse = useTestMode((s) => s.curse);
  const hasBot = view.players.some((p) => p.id === `bot-${rival}-builder`);
  if (!hasBot) {
    return (
      <p className="text-xs font-semibold text-ink/60">
        {CREW_NAME[rival]} has people in it: they play for themselves.
      </p>
    );
  }
  const own = view.crews[rival].round !== null;
  const yours = view.crews[rival === 'orange' ? 'teal' : 'orange'].round !== null;
  const rivalAct = (target: 'own' | 'steal', choice: 'keep' | 'curse') =>
    act({ kind: 'rival', target, choice, ...(curse && { curse }) });
  const { charges } = view.crews[rival];
  return (
    <>
      <div className="grid grid-cols-2 gap-1">
        <Small disabled={!own} onClick={() => rivalAct('own', 'keep')}>
          Solve theirs, keep it
        </Small>
        <Small disabled={!own} onClick={() => rivalAct('own', 'curse')}>
          Solve theirs, curse at you
        </Small>
        <Small disabled={!yours} onClick={() => rivalAct('steal', 'keep')}>
          Steal yours, keep it
        </Small>
        <Small disabled={!yours} onClick={() => rivalAct('steal', 'curse')}>
          Steal yours, curse at you
        </Small>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs font-semibold text-ink/70">Cast at you:</span>
        {charges.length === 0 && (
          <span className="text-xs text-ink/50">no spells (give some ↓)</span>
        )}
        {charges.map((spell, slot) => (
          <Small key={slot} onClick={() => act({ kind: 'rival-cast', slot })}>
            {SPELL_LABEL[spell].icon} {SPELL_LABEL[spell].name}
          </Small>
        ))}
      </div>
    </>
  );
}

function GiveSpells({ view, team }: { view: RoomView; team: Team }) {
  const full = view.crews[team].charges.length >= SPELL_TUNING.maxCharges;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-14 text-xs font-semibold text-ink/70">{CREW_NAME[team]}</span>
      {SPELLS.map((spell) => (
        <Small
          key={spell}
          disabled={full}
          aria-label={`Give ${CREW_NAME[team]} ${SPELL_LABEL[spell].name}`}
          onClick={() => act({ kind: 'grant', team, spell })}
        >
          {SPELL_LABEL[spell].icon} {SPELL_LABEL[spell].name}
        </Small>
      ))}
    </div>
  );
}

function Checklist() {
  const { done, toggle, reset } = useTestMode();
  return (
    <div className="flex flex-col gap-3">
      {CHECKLIST.map((group) => (
        <fieldset key={group.title} className="flex flex-col gap-1">
          <legend className="mb-1 text-xs font-bold text-dusk-800">{group.title}</legend>
          {group.items.map((item) => (
            <label key={item.id} className="flex cursor-pointer gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={done.has(item.id)}
                onChange={(e) => {
                  toggle(item.id);
                  // Let go of the keyboard, so Space drops the piece instead of ticking again.
                  e.currentTarget.blur();
                }}
                className="mt-0.5 size-4 shrink-0 accent-coral"
              />
              <span className={done.has(item.id) ? 'text-ink/45 line-through' : ''}>
                {item.label}
                {item.how && <span className="block text-[0.6875rem] text-ink/55">{item.how}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      <Small onClick={reset} className="self-start">
        Untick everything
      </Small>
    </div>
  );
}

/**
 * Test mode's control panel (docs/tower/planning/test-mode.md), in a column of its own left of
 * the towers so it never hides them: what the next piece's curse is, what the rival bot does,
 * spells for either crew, golden drawings, stars, and a checklist of what to try. It folds away
 * to a thin strip.
 */
export function TestPanel({ view, team }: { view: RoomView; team: Team }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'controls' | 'checklist'>('controls');
  const done = useTestMode((s) => s.done.size);
  const rival: Team = team === 'orange' ? 'teal' : 'orange';

  if (!open) {
    return (
      <Button
        variant="sun"
        aria-label="Show the test panel"
        className="h-full w-9 px-0 [writing-mode:vertical-rl]"
        onClick={() => setOpen(true)}
      >
        🧪 Test panel
      </Button>
    );
  }
  return (
    <aside
      aria-label="Test panel"
      className="card-panel flex min-h-0 w-[17rem] flex-col gap-3 rounded-2xl p-3"
    >
      <div className="flex items-center gap-1" role="tablist">
        <Small
          role="tab"
          aria-selected={tab === 'controls'}
          pressed={tab === 'controls'}
          onClick={() => setTab('controls')}
        >
          Controls
        </Small>
        <Small
          role="tab"
          aria-selected={tab === 'checklist'}
          pressed={tab === 'checklist'}
          onClick={() => setTab('checklist')}
        >
          Checklist {done}/{CHECK_COUNT}
        </Small>
        <Small aria-label="Hide the test panel" className="ml-auto" onClick={() => setOpen(false)}>
          ✕
        </Small>
      </div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {tab === 'controls' ? (
          <>
            <Section title="Next piece's curse">
              <CursePicker />
            </Section>
            <Section title={`The rival (${CREW_NAME[rival]} buildbot)`}>
              <RivalControls view={view} rival={rival} />
            </Section>
            <Section title="Give a spell">
              <GiveSpells view={view} team={team} />
              <GiveSpells view={view} team={rival} />
            </Section>
            <Section title="Golden words and stars">
              <div className="flex flex-wrap gap-1">
                <Small
                  disabled={!view.crews[team].round || view.crews[team].round.golden}
                  onClick={() => act({ kind: 'golden', team })}
                >
                  ✨ Make ours golden
                </Small>
                <Small
                  disabled={!view.crews[rival].round || view.crews[rival].round.golden}
                  onClick={() => act({ kind: 'golden', team: rival })}
                >
                  ✨ Make theirs golden
                </Small>
                <Small onClick={() => act({ kind: 'stars' })}>⭐ Stars now</Small>
              </div>
            </Section>
          </>
        ) : (
          <Checklist />
        )}
      </div>
    </aside>
  );
}
