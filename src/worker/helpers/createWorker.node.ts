/**
 * Create a Worker instance for Node.js environment.
 *
 * @internal
 * @param workerURL Custom worker URL or undefined to use bundled worker
 * @returns Worker instance
 */
export async function createWorker(workerURL?: string | URL): Promise<Worker> {
  // Dynamic import for Node.js Worker and URL utilities
  const { Worker } = await import("node:worker_threads");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");

  if (workerURL) {
    // Use provided worker URL
    // @ts-expect-error: Node.js Worker accepts { type: "module" } but Web Worker types don't include this
    return new Worker(workerURL, { type: "module" }) as unknown as Worker;
  }

  // Compute worker.node.js path relative to this module
  // In Node.js, import.meta.url is a file:// URL pointing to this module
  // In production: Worker file is at dist/node/worker.node.js, this file is at dist/node/worker/helpers/createWorker.node.js
  // In test: Worker file is at dist/node/worker.node.js (built), this file is at src/worker/helpers/createWorker.node.ts (source)
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFilePath);

  // Check if running from source (test environment) or from dist (production)
  const isFromSource = currentFilePath.includes("/src/");
  const workerPath = isFromSource
    ? join(currentDir, "..", "..", "..", "dist", "node", "worker.node.js") // From src/worker/helpers to dist/node/worker.node.js
    : join(currentDir, "..", "..", "worker.node.js"); // From dist/node/worker/helpers to dist/node/worker.node.js

  // @ts-expect-error: Node.js Worker accepts { type: "module" } but Web Worker types don't include this
  return new Worker(workerPath, { type: "module" }) as unknown as Worker;
}
