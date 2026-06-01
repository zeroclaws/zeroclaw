import Fastify from 'fastify';
import { DEFAULT_SETUP_PORT } from '../../shared/constants.js';

export async function startSetupDashboard(port = DEFAULT_SETUP_PORT): Promise<void> {
  const token = crypto.randomUUID();
  const app = Fastify({ logger: false });

  app.get('/', async (request, reply) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    if (url.searchParams.get('token') !== token) {
      reply.code(401);
      return 'Unauthorized. Use the setup URL printed by zeroclaw setup.\n';
    }
    reply.type('text/html');
    return '<!doctype html><title>Zeroclaw Setup</title><h1>Zeroclaw Setup</h1><p>Temporary setup dashboard is running.</p>';
  });

  await app.listen({ host: '0.0.0.0', port });
  console.log(`Zeroclaw setup dashboard:`);
  console.log(`http://127.0.0.1:${port}/?token=${token}`);
  console.log('Press Ctrl+C to stop.');
}
