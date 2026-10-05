import { sendToRoom, useRoomStore } from '../../../realtime';

/**
 * ❤️ on the drawing, in the board's corner while it's drawn and at its reveal. Guessers toggle
 * their like; the drawer sees how many people like it. The room's most-liked drawing becomes its
 * cover on the home page (game-rules.md, likes).
 */
export function LikeButton() {
  const view = useRoomStore((s) => s.view);
  const likes = view?.likes;
  if (!view || !likes || (view.phase.kind !== 'drawing' && view.phase.kind !== 'reveal')) {
    return null;
  }
  const count = likes.likers.length;
  const badge =
    'absolute right-3 bottom-3 z-30 flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink shadow-[2px_2px_0_var(--color-ink)]';

  if (likes.drawerId === view.you) {
    if (count === 0) return null;
    return (
      <p className={badge} role="status">
        <span aria-hidden="true">❤️</span> {count} {count === 1 ? 'person likes' : 'people like'}{' '}
        your drawing
      </p>
    );
  }

  const liked = likes.likers.includes(view.you);
  return (
    <button
      type="button"
      aria-pressed={liked}
      onClick={() => sendToRoom({ t: 'turn:like', liked: !liked })}
      className={`${badge} transition hover:-translate-y-0.5 ${liked ? 'bg-pop-pink/40' : ''}`}
      title="The room's most-liked drawing becomes its cover"
    >
      <span aria-hidden="true" className={liked ? '' : 'grayscale'}>
        ❤️
      </span>
      {liked ? 'Liked' : 'Like'}
      {count > 0 && <span className="tabular-nums">· {count}</span>}
    </button>
  );
}
