/**
 * Create a Worker instance for browser/Deno environment.
 *
 * @internal
 * @param workerURL Custom worker URL or undefined to use bundled worker
 * @returns Worker instance
 */
export async function createWorker(workerURL?: string | URL): Promise<Worker> {
  // Use @vite-ignore to prevent Vite from inlining the worker as a data URL
  // In production, import.meta.url points to dist/execution/worker/helpers/createWorker.web.js
  // so "./worker.js" correctly resolves to dist/execution/worker/helpers/worker.js
  const url =
    workerURL || new URL(/* @vite-ignore */ "./worker.js", import.meta.url);
  return new Worker(url, { type: "module" });
}
