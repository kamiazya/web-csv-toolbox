import { createWorker } from "#execution/worker/createWorker.js";

/**
 * Singleton worker instance manager.
 * Provides centralized worker lifecycle management.
 *
 * @internal
 */
let workerInstance: Worker | null = null;
let requestId = 0;

/**
 * Get or create a worker instance.
 * If WorkerPool is provided in options, use it instead of singleton.
 *
 * @internal
 */
export async function getWorker(workerURL?: string | URL): Promise<Worker> {
  if (!workerInstance) {
    workerInstance = await createWorker(workerURL);
  }
  return workerInstance;
}

/**
 * Get next request ID for message tracking.
 *
 * @internal
 */
export function getNextRequestId(): number {
  return requestId++;
}

/**
 * Terminate the singleton worker instance.
 *
 * @internal
 */
export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}

/**
 * Reset request ID counter (mainly for testing).
 *
 * @internal
 */
export function resetRequestId(): void {
  requestId = 0;
}
