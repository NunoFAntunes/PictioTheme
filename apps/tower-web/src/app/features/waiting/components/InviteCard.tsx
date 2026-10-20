import { useEffect, useState } from 'react';
import { sendToRoom, type RoomView } from '../../../realtime';
import { Button } from '../../../ui/Button';
import { Panel } from '../../../ui/Panel';
import { canCopyImages, cardUrl, copyCardImage, copyInviteLink } from '../invite';

type Copied = 'link' | 'image' | 'failed' | null;

/**
 * How friends get in: the room's share card as chat apps will show it, the code, and buttons to
 * copy the invite link (pasted in Discord, WhatsApp… it unfurls into the card) or the card itself.
 * The host also picks whether Quick game can bring strangers in.
 */
export function InviteCard({ view }: { view: RoomView }) {
  const isHost = view.hostId === view.you;
  const [copied, setCopied] = useState<Copied>(null);
  const { line, roundSeconds, steals, isPublic } = view.settings;
  const hostName = view.players.find((p) => p.id === view.hostId)?.name ?? '';

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (what: 'link' | 'image') => {
    try {
      await (what === 'link' ? copyInviteLink(view.code) : copyCardImage(view.code));
      setCopied(what);
    } catch {
      setCopied('failed');
    }
  };

  return (
    <Panel title="Invite your friends">
      <div className="flex flex-col gap-4 px-2 md:flex-row md:items-center">
        <img
          // Redrawn when something on it changes.
          src={cardUrl(view.code, [hostName, line, roundSeconds, steals].join('.'))}
          alt={`The invite card for room ${view.code}`}
          width={1200}
          height={630}
          className="aspect-[1200/630] w-full max-w-sm shrink-0 rounded-2xl bg-sky-light shadow-[0_4px_0_var(--color-card-edge)]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-ink/75">Room code</span>
            <span
              className="rounded-xl bg-sun px-3 py-1 font-display text-3xl tracking-[0.2em] text-sun-ink shadow-[0_4px_0_var(--color-sun-dark)]"
              data-testid="room-code"
            >
              {view.code}
            </span>
          </div>
          <p className="text-sm font-medium text-ink/70">
            Paste the link in Discord, WhatsApp or anywhere: it shows up as this card, and one click
            brings your friends in.
          </p>
          <div aria-live="polite" className="flex flex-wrap gap-2">
            <Button variant="primary" className="h-11 px-4" onClick={() => void copy('link')}>
              {copied === 'link' ? '✓ Link copied' : 'Copy invite link'}
            </Button>
            {canCopyImages() && (
              <Button className="h-11 px-4" onClick={() => void copy('image')}>
                {copied === 'image' ? '✓ Card copied' : 'Copy the card'}
              </Button>
            )}
            {copied === 'failed' && (
              <span className="self-center text-sm font-semibold text-danger">
                Couldn’t copy. Try again?
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink/75">Who can join</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Who can join">
              <Button
                pressed={!isPublic}
                disabled={!isHost}
                className="text-xs"
                onClick={() => sendToRoom({ t: 'settings:update', settings: { isPublic: false } })}
              >
                🔒 Friends with the link
              </Button>
              <Button
                pressed={isPublic}
                disabled={!isHost}
                className="text-xs"
                onClick={() => sendToRoom({ t: 'settings:update', settings: { isPublic: true } })}
              >
                🌍 Anyone (Quick game)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
