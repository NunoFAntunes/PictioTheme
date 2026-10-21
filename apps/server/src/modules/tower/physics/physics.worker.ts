import {
  createTowerWorld,
  loadPhysics,
  STEP_SECONDS,
  type TowerWorld,
} from '@pictiotheme/tower-physics';
import { parentPort } from 'node:worker_threads';
import {
  FRAME_EVERY,
  FULL_FRAME_EVERY,
  HEIGHT_EVERY,
  type FromWorker,
  type ToWorker,
} from './physics-messages';

/**
 * A physics worker thread (docs/tower/technical/architecture.md#server-the-tower-module): it
 * steps every tower world it owns at 60 Hz and reports back frames, releases, fumbles and
 * heights. Running here, a busy step can never delay DoodleWhirl's rooms or the HTTP API.
 */

const port = parentPort;
if (!port) throw new Error('physics.worker.ts must run as a worker thread');

type World = { world: TowerWorld; stopped: boolean };
const worlds = new Map<string, World>();
const post = (msg: FromWorker) => port.postMessage(msg);

function handle(msg: ToWorker): void {
  switch (msg.t) {
    case 'create':
      worlds.get(msg.world)?.world.free();
      worlds.set(msg.world, { world: createTowerWorld(), stopped: true });
      return;
    case 'dispose':
      worlds.get(msg.world)?.world.free();
      worlds.delete(msg.world);
      return;
    case 'op': {
      const entry = worlds.get(msg.world);
      if (!entry) return;
      const { physics } = msg;
      switch (physics.op) {
        case 'reset':
          entry.world.free();
          entry.world = createTowerWorld();
          entry.stopped = false;
          post({ t: 'frame', world: msg.world, tick: 0, bodies: [], full: true });
          return;
        case 'spawn':
          entry.world.spawnAbove(
            { outline: physics.outline, parts: physics.parts },
            physics.gap,
            physics.pieceId,
            {
              ...(physics.friction !== undefined && { friction: physics.friction }),
              ...(physics.restitution !== undefined && { restitution: physics.restitution }),
              ...(physics.bouncyMs !== undefined && { bouncyMs: physics.bouncyMs }),
            },
          );
          return;
        case 'steer': {
          const { op: _op, ...steer } = physics;
          entry.world.steer(steer);
          return;
        }
        case 'drop':
          entry.world.drop();
          return;
        case 'star':
          entry.world.setStar(physics.x, physics.y, physics.radius);
          return;
        case 'unstar':
          entry.world.clearStar();
          return;
        case 'pigeon':
          entry.world.landPigeon(physics.side);
          return;
        case 'unpigeon':
          entry.world.clearPigeon();
          return;
        case 'stop':
          entry.stopped = true;
          return;
      }
    }
  }
}

function stepAll(): void {
  for (const [id, entry] of worlds) {
    if (entry.stopped) continue;
    const { world } = entry;
    const events = world.step();
    if (events.released) post({ t: 'released', world: id, pieceId: events.released.id });
    if (events.fumbled.length > 0) post({ t: 'fumbled', world: id, pieceIds: events.fumbled });
    if (events.pigeon) post({ t: 'pigeonGone', world: id });
    const { tick } = world;
    if (tick % FRAME_EVERY === 0) {
      const full = tick % FULL_FRAME_EVERY === 0;
      const bodies = world.frame(!full);
      if (full || bodies.length > 0) post({ t: 'frame', world: id, tick, bodies, full });
    }
    if (tick % HEIGHT_EVERY === 0) {
      post({ t: 'height', world: id, height: world.height(), starHeld: world.starHeld() });
    }
  }
}

const pending: ToWorker[] = [];
let ready = false;
port.on('message', (msg: ToWorker) => {
  if (!ready) {
    pending.push(msg);
    return;
  }
  try {
    handle(msg);
  } catch (err) {
    post({ t: 'failed', world: 'world' in msg ? msg.world : null, message: String(err) });
  }
});

await loadPhysics();
ready = true;
for (const msg of pending.splice(0)) handle(msg);
post({ t: 'ready' });

// A fixed 60 Hz step, catching up after a slow tick (at most a few steps, so a stall can't
// snowball).
const stepMs = STEP_SECONDS * 1000;
let last = performance.now();
let behind = 0;
setInterval(() => {
  const now = performance.now();
  behind = Math.min(behind + (now - last), stepMs * 5);
  last = now;
  while (behind >= stepMs) {
    try {
      stepAll();
    } catch (err) {
      post({ t: 'failed', world: null, message: String(err) });
    }
    behind -= stepMs;
  }
}, stepMs / 2);
