import { MAX_POINTS_PER_MESSAGE } from '@pictiotheme/protocol';
import type { Team, TowerDrawOp } from '@pictiotheme/protocol/tower';
import { drawAndSend, sendToRoom, strokeModels } from '../../realtime';

/**
 * The drawer's strokes, out to the room. Each operation is drawn on the crew's board right away;
 * points go out in batches every 33 ms, as in DoodleWhirl (realtime-protocol.md#drawing-sync),
 * so a fast pointer doesn't send 120 messages a second.
 */

const FLUSH_MS = 33;

export function createDrawSender(team: Team) {
  let pending: { id: string; pts: number[] } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

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
        drawAndSend(team, op);
        return;
      }
      // Drawn now, sent with the next batch.
      strokeModels[team].apply(op);
      if (pending?.id !== op.id) pending = { id: op.id, pts: [] };
      pending.pts.push(...op.pts);
      timer ??= setTimeout(flush, FLUSH_MS);
    },
    dispose(): void {
      flush();
    },
  };
}
