import closeWithGrace from 'close-with-grace';
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = await buildApp(config);

// Graceful shutdown: docs/technical/backend-guidelines.md#lifecycle-and-graceful-shutdown
closeWithGrace({ delay: 10_000 }, async ({ signal, err }) => {
  if (err) app.log.error({ err }, 'shutting down after an error');
  else app.log.info({ signal }, 'shutting down');
  await app.close();
});

await app.listen({ host: config.host, port: config.port });
