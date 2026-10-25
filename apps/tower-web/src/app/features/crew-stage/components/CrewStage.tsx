import type { AvatarId, PlayerId } from '@pictiotheme/protocol';
import { TEAMS } from '@pictiotheme/protocol/tower';
import { useEffect, useRef } from 'react';
import { myTeam, serverNow, useRoomStore } from '../../../realtime';
import { playStageCue } from '../../sound';
import { actsAfter, lastEventKey, shivering } from '../acts';
import { locateAnchors } from '../anchors';
import { standPoints, type Stand } from '../ledges';
import { createReactions } from '../reactions';
import { seatsOf } from '../seats';
import { createShow, type Spot, type SpotKey } from '../show';
import { drawStage } from '../stage';
import { stickerOf } from '../stickers';
import { createTroupe, type Target } from '../troupe';

/** The other crew's comings and goings are quieter, like their tower's village. */
const RIVAL_VOLUME = 0.4;

/**
 * Everyone's avatar, where they are in the match (docs/tower/design/screens.md#the-crews-on-stage):
 * one see-through canvas over the whole game screen, drawn every animation frame from the room
 * view and the anchors the screen registers. When someone's role changes they fly to their new
 * place (`troupe.ts`), act out the powers (`show.ts`) and react to how the match goes
 * (`reactions.ts`), with sounds. Clicks go straight through it.
 */
export function CrewStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const troupe = createTroupe({ still });
    const show = createShow({ still });
    const reactions = createReactions({ still });
    // The events already there when the stage (or a new room) shows up aren't acted out again.
    let seen: { code: string; key: number } | null = null;
    let frame = 0;
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const view = useRoomStore.getState().view;
      const dpr = window.devicePixelRatio || 1;
      const size = { width: canvas.clientWidth, height: canvas.clientHeight };
      if (!view || !size.width || !size.height) return;
      // Read the layout first, then write the canvas size, so the browser lays out only once.
      const ledges = locateAnchors();
      if (canvas.width !== Math.round(size.width * dpr))
        canvas.width = Math.round(size.width * dpr);
      if (canvas.height !== Math.round(size.height * dpr))
        canvas.height = Math.round(size.height * dpr);

      const team = myTeam(view);
      const clock = serverNow();
      if (seen?.code !== view.code) seen = { code: view.code, key: lastEventKey(view) };
      const acts = actsAfter(view, seen.key, clock);
      show.add(acts, now);
      reactions.add(acts, now);
      seen.key = Math.max(seen.key, lastEventKey(view));
      const targets: Target[] = [];
      const avatars = new Map<PlayerId, AvatarId>();
      const stands = new Map<string, Stand[]>();
      for (const seat of seatsOf(view, (key) => ledges.has(key))) {
        const ledge = ledges.get(seat.anchor);
        // Not drawn until their drawing has loaded, so nobody flies in as a blank.
        if (!ledge || !stickerOf(seat.avatar)) continue;
        let points = stands.get(seat.anchor);
        if (!points) {
          points = standPoints(ledge, seat.of);
          stands.set(seat.anchor, points);
        }
        const stand = points[seat.slot];
        if (!stand) continue;
        avatars.set(seat.playerId, seat.avatar);
        targets.push({
          playerId: seat.playerId,
          team: seat.team,
          anchor: seat.anchor,
          slot: seat.slot,
          stand,
          cloud: ledge.cloud ?? false,
          asleep: seat.asleep,
          // You, placing: your cloud stays still under you for those 15s.
          calm: seat.kind === 'cloud' && seat.playerId === view.you,
        });
      }
      const result = troupe.update(targets, now);
      const spot = (key: SpotKey): Spot | null => {
        const ledge = ledges.get(key);
        return ledge ? { x: (ledge.left + ledge.right) / 2, y: ledge.y, size: ledge.size } : null;
      };
      const calm = targets.find((t) => t.calm)?.playerId ?? null;
      const acted = show.frame({
        now,
        poses: result.poses,
        spot,
        shivering: shivering(view, clock),
        calm,
      });
      const reacted = reactions.frame({
        now,
        poses: acted.poses,
        spot,
        dazed: new Set(TEAMS.filter((t) => (view.crews[t].dazedUntil ?? 0) > clock)),
        topping: new Set(TEAMS.filter((t) => view.crews[t].toppingUntil !== null)),
        calm,
      });
      const pan = (x: number) => ((x / size.width) * 2 - 1) * 0.6;
      for (const cue of result.cues) {
        playStageCue(cue.kind === 'land' && cue.soft ? 'land-soft' : cue.kind, cue.pitch, {
          volume: cue.team === team ? 1 : RIVAL_VOLUME,
          pan: pan(cue.x),
        });
      }
      for (const cue of acted.cues) {
        playStageCue(cue.kind, 1, {
          volume: cue.team === team ? 1 : RIVAL_VOLUME,
          pan: pan(cue.x),
        });
      }
      drawStage(
        ctx,
        size,
        dpr,
        { troupe: result, show: acted, reactions: reacted },
        avatars,
        stickerOf,
        now,
      );
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="crew-stage"
      className="pointer-events-none fixed inset-0 z-40 h-full w-full"
    />
  );
}
