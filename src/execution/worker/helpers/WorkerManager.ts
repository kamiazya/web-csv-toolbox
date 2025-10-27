import { WorkerPool } from "./WorkerPool.ts";

/**
 * Global default worker pool (single worker for backward compatibility).
 * Provides centralized worker lifecycle management.
 *
 * Users can use WorkerPool directly for multiple workers.
 *
 * @internal
 */
const defaultPool = new WorkerPool({ maxWorkers: 1 });

/**
 * Get or create a worker instance from the default pool.
 * If WorkerPool is provided in options, use it instead of default pool.
 *
 * @internal
 */
export async function getWorker(workerURL?: string | URL): Promise<Worker> {
  return defaultPool.getWorker(workerURL);
}

/**
 * Get next request ID for message tracking from the default pool.
 *
 * @internal
 */
export function getNextRequestId(): number {
  return defaultPool.getNextRequestId();
}

/**
 * Terminate the default worker pool.
 *
 * @internal
 */
export function terminateWorker(): void {
  defaultPool[Symbol.dispose]();
}

/**
 * Get the current size of the default pool.
 * This is mainly for testing purposes.
 *
 * @internal
 */
export function getPoolSize(): number {
  return defaultPool.size;
}
