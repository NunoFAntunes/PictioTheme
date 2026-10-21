import { MAX_POINTS_PER_MESSAGE } from '@pictiotheme/protocol';
import { shakePoints, type Team, type TowerDrawOp } from '@pictiotheme/protocol/tower';
import { drawAndSend, sendToRoom, serverNow, strokeModels, useRoomStore } from '../../realtime';

/**
 * The drawer's strokes, out to the room. Each operation is drawn on the crew's board right away;
 * points go out in batches every 33 ms, as in DoodleWhirl (realtime-protocol.md#drawing-sync),
 * so a fast pointer doesn't send 120 messages a second.
 *
 * Under the other crew's Shaky hand spell, a stroke begun while it lasts wobbles: the server
 * wobbles the points it keeps and forwards, and this draws them the same way (`shakePoints`), so
 * what the drawer sees is what everyone sees. Raw points go out; the server decides.
 */

function shakyNow(team: Team): boolean {
  const spell = useRoomStore.getState().view?.crews[team].spell;
  const now = serverNow();
  return spell?.spell === 'shaky' && now >= spell.startsAt && now < spell.endsAt;
}

const FLUSH_MS = 33;

export function createDrawSender(team: Team) {
  let pending: { id: string; pts: number[] } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Strokes begun under Shaky hand, and how many points each has had so far. */
  const shaky = new Map<string, number>();

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending || pending.pts.length === 0) return;
    const { id, pts } = pending;
    for (let i = 0; i < pts.length; i += MAX_POINTS_PER_MESSAGE * 3) {
      sendToRoom({ t: 'draw:pts', id, pts: pts.slice(i, i + MAX_POINTS_PER_MESSAGE * 3) });
    }
    pending = { id, pts: [] };
  };

  return {
    send(op: TowerDrawOp): void {
      if (op.t !== 'draw:pts') {
        flush();
        if (op.t === 'draw:begin') pending = { id: op.id, pts: [] };
        if (op.t === 'draw:end') pending = null;
        if (op.t === 'draw:begin' && shakyNow(team)) {
          shaky.set(op.id, 1);
          const [x, y] = shakePoints([op.x, op.y, 0.5], op.id, 0) as [number, number];
          strokeModels[team].apply({ ...op, x, y });
          sendToRoom(op);
          return;
        }
        drawAndSend(team, op);
        return;
      }
      // Drawn now, sent with the next batch.
      const done = shaky.get(op.id);
      if (done === undefined) {
        strokeModels[team].apply(op);
      } else {
        strokeModels[team].apply({ ...op, pts: shakePoints(op.pts, op.id, done) });
        shaky.set(op.id, done + op.pts.length / 3);
      }
      if (pending?.id !== op.id) pending = { id: op.id, pts: [] };
      pending.pts.push(...op.pts);
      timer ??= setTimeout(flush, FLUSH_MS);
    },
    dispose(): void {
      flush();
    },
  };
}
