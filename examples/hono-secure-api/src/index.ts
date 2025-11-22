import { serve } from '@hono/node-server';
import { ReusableWorkerPool } from 'web-csv-toolbox';
import { createApp, SECURITY_CONFIG } from './app';

export { SECURITY_CONFIG, createApp };

// Initialize worker pool
export const pool = new ReusableWorkerPool({
  maxWorkers: SECURITY_CONFIG.maxWorkers,
});

// Create app with the pool
const app = createApp(pool);

// Cleanup on shutdown
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    pool.terminate();
  });
}

// Start server only if not imported as module
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;

  console.log(`Starting Hono Secure CSV API on port ${port}...`);

  serve({
    fetch: app.fetch,
    port,
  }, (info: { address: string; family: string; port: number }) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.log(`Worker pool: max ${SECURITY_CONFIG.maxWorkers} workers`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    pool.terminate();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    pool.terminate();
    process.exit(0);
  });
}

export default app;
