import fp from 'fastify-plugin';
import { forbidden } from '../lib/errors';

/**
 * CSRF protection for a same-origin app (rule F12): a browser request that changes state must
 * come from our own origin. Requests without an Origin header (curl, server-to-server) pass;
 * browsers always send it on cross-origin POSTs and WebSocket upgrades.
 */
export const originCheck = fp<{ publicOrigin: string }>(
  async (app, { publicOrigin }) => {
    app.addHook('onRequest', async (request) => {
      const isUpgrade = request.headers.upgrade?.toLowerCase() === 'websocket';
      const isSafe = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
      if (isSafe && !isUpgrade) return;
      const origin = request.headers.origin;
      if (origin !== undefined && origin !== publicOrigin) {
        throw forbidden('Cross-origin request blocked');
      }
    });
  },
  { name: 'origin-check' },
);
