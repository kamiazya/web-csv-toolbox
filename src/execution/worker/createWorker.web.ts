/**
 * Create a Worker instance for browser/Deno environment.
 *
 * @internal
 * @param workerURL Custom worker URL or undefined to use bundled worker
 * @returns Worker instance
 */
export async function createWorker(
  workerURL?: string | URL,
): Promise<Worker> {
  const url = workerURL || new URL("./worker.js", import.meta.url);
  return new Worker(url, { type: "module" });
}
