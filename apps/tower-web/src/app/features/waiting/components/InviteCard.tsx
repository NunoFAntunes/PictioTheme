import { useEffect, useState } from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { Button } from '../../../ui/Button';
import { Panel } from '../../../ui/Panel';
import { Switch } from '../../../ui/Switch';
import { cardUrl, copyInviteLink } from '../invite';

type Copied = 'link' | 'failed' | null;

/**
 * How friends get in: the room's share card, just as chat apps show the invite link (pasted in
 * Discord, WhatsApp… it unfurls into this card), the code, and a button to copy the link. The host
 * also switches whether Quick game can bring strangers in.
 */
export function InviteCard({ view, className = '' }: { view: RoomView; className?: string }) {
  const isHost = view.hostId === view.you;
  const [copied, setCopied] = useState<Copied>(null);
  const { line, roundSeconds, steals, isPublic } = view.settings;
  const hostName = view.players.find((p) => p.id === view.hostId)?.name ?? '';
  const setPublic = (open: boolean) =>
    sendToRoom({ t: 'settings:update', settings: { isPublic: open } });

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await copyInviteLink(view.code);
      setCopied('link');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <Panel title="Invite your friends" className={`flex flex-col ${className}`}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 px-2">
        <div className="flex min-h-0 shrink items-center justify-center py-1">
          <img
            // Redrawn when something on it changes.
            src={cardUrl(view.code, [hostName, line, roundSeconds, steals].join('.'))}
            alt={`The invite card for room ${view.code}`}
            width={1200}
            height={630}
            className="max-h-full w-auto max-w-full -rotate-1 rounded-[1.4rem] shadow-[0_6px_0_var(--color-card-edge),0_14px_26px_oklch(0.3_0.12_265/0.22)] transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.02] hover:rotate-0"
          />
        </div>
        <div className="flex items-center gap-3">
          <span
            className="shrink-0 rounded-xl bg-sun px-3 py-1 font-display text-2xl tracking-[0.18em] text-sun-ink shadow-[0_4px_0_var(--color-sun-dark)]"
            data-testid="room-code"
            title="Room code"
          >
            {view.code}
          </span>
          <Button variant="primary" className="h-12 flex-1 text-base" onClick={() => void copy()}>
            {copied === 'link' ? '🎈 Link copied!' : '🔗 Copy invite link'}
          </Button>
        </div>
        <p aria-live="polite" className="text-sm font-medium text-ink/70">
          {copied === 'failed' ? (
            <span className="font-semibold text-danger">Couldn’t copy. Try again?</span>
          ) : (
            'Paste it in Discord, WhatsApp… and it shows up as this card.'
          )}
        </p>
      </div>

      <div className="mx-2 mt-4 flex items-center justify-between gap-3 border-t-[3px] border-dashed border-card-edge pt-3">
        <span className="font-display text-sm tracking-wide text-dusk-800 uppercase">
          Who can join
        </span>
        <div className="flex items-center gap-2.5 font-display text-sm">
          <button
            type="button"
            disabled={!isHost}
            onClick={() => setPublic(false)}
            className={`transition-colors enabled:cursor-pointer disabled:cursor-default ${isPublic ? 'text-ink/40' : 'text-ink'}`}
          >
            Friends
          </button>
          <Switch
            checked={isPublic}
            onChange={setPublic}
            label="Anyone can join with Quick game"
            disabled={!isHost}
            knob={isPublic ? '🌍' : '🔒'}
            onText=""
            offText=""
            onTrack="bg-sky"
            offTrack="bg-dusk-700"
          />
          <button
            type="button"
            disabled={!isHost}
            onClick={() => setPublic(true)}
            className={`transition-colors enabled:cursor-pointer disabled:cursor-default ${isPublic ? 'text-ink' : 'text-ink/40'}`}
          >
            Anyone
          </button>
        </div>
      </div>
      <p className="mx-2 mt-1 text-right text-xs font-medium text-ink/60">
        {isPublic ? 'Quick game can bring in players' : 'Only people with the link'}
      </p>
    </Panel>
  );
}
