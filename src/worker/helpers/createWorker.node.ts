/**
 * Create a Worker instance for Node.js environment.
 *
 * @internal
 * @param workerURL Custom worker URL or undefined to use bundled worker
 * @returns Worker instance
 */
export async function createWorker(workerURL?: string | URL): Promise<Worker> {
  // Dynamic import for Node.js Worker and URL utilities
  // @ts-expect-error: node:worker_threads is only available in Node.js
  const { Worker } = await import("node:worker_threads");
  // @ts-expect-error: node:url is only available in Node.js
  const { fileURLToPath } = await import("node:url");
  // @ts-expect-error: node:path is only available in Node.js
  const { dirname, join } = await import("node:path");

  if (workerURL) {
    // Use provided worker URL
    return new Worker(workerURL, { type: "module" });
  }

  // Compute worker.node.js path relative to this module
  // In Node.js, import.meta.url is a file:// URL pointing to this module
  // In production: Worker file is at dist/worker.node.js, this file is at dist/worker/helpers/createWorker.node.js
  // In test: Worker file is at dist/worker.node.js (built), this file is at src/worker/helpers/createWorker.node.ts (source)
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFilePath);

  // Check if running from source (test environment) or from dist (production)
  const isFromSource = currentFilePath.includes("/src/");
  const workerPath = isFromSource
    ? join(currentDir, "..", "..", "..", "dist", "worker.node.js") // From src/worker/helpers to dist/worker.node.js
    : join(currentDir, "..", "..", "worker.node.js"); // From dist/worker/helpers to dist/worker.node.js

  return new Worker(workerPath, { type: "module" });
}
