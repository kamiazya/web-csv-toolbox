import { TransientWorkerPool } from "@/worker/helpers/TransientWorkerPool.ts";

/**
 * Global default worker pool using transient workers.
 * Workers are automatically terminated after each job to prevent process hanging.
 *
 * Users can use ReusableWorkerPool directly for persistent worker pools.
 *
 * @internal
 */
const defaultPool = new TransientWorkerPool();

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
 * Release a worker back to the default pool.
 * For the default transient pool, this terminates the worker.
 *
 * @internal
 */
export function releaseWorker(worker: Worker): void {
  defaultPool.releaseWorker(worker);
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
