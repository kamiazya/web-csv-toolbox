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
  // Worker file is at dist/worker.node.js, this file is at dist/worker/helpers/createWorker.node.js
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFilePath);
  const workerPath = join(currentDir, "..", "..", "worker.node.js");

  return new Worker(workerPath, { type: "module" });
}
