import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db/index.js';
import { registerApiRoutes } from './api/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// Serve static frontend files
app.register(import('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// API routes
registerApiRoutes(app);

// Root redirects to dashboard
app.get('/', async (req, reply) => {
  return reply.sendFile('index.html');
});

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 CacheMeIfYouCan running at http://localhost:3000');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
