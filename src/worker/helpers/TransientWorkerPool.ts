import { createWorker } from "#/worker/helpers/createWorker.js";
import type { WorkerPool } from "@/core/types.ts";

/**
 * Options for configuring the TransientWorkerPool.
 */
export interface TransientWorkerPoolOptions {
  /**
   * Custom worker URL to use for all workers in the pool.
   */
  workerURL?: string | URL | undefined;
}

/**
 * A pool that creates transient workers which are automatically terminated after each job.
 *
 * This pool is designed for the default worker pool to prevent workers from staying alive
 * and blocking process exit. Each worker is terminated immediately after the job completes.
 *
 * @remarks
 * **Design Rationale:**
 *
 * Unlike {@link ReusableWorkerPool} which keeps workers alive for reuse, `TransientWorkerPool`
 * terminates workers after each job. This is specifically designed for the internal default pool
 * to avoid requiring users to call `terminateWorkers()` for process cleanup.
 *
 * **Characteristics:**
 * - Workers are created on-demand
 * - Workers are terminated immediately after job completion
 * - No persistent worker instances
 * - Prevents process from hanging due to active workers
 *
 * @internal
 */
export class TransientWorkerPool implements WorkerPool, Disposable {
  private requestId = 0;
  private readonly customWorkerURL?: string | URL | undefined;

  /**
   * Create a new TransientWorkerPool.
   *
   * @param options - Configuration options for the pool
   */
  constructor(options: TransientWorkerPoolOptions = {}) {
    this.customWorkerURL = options.workerURL;
  }

  /**
   * Get a worker instance.
   * Always creates a new worker for transient usage.
   *
   * @param workerURL - Optional custom worker URL (overrides pool's workerURL)
   * @returns A new worker instance
   * @internal
   */
  async getWorker(workerURL?: string | URL): Promise<Worker> {
    const effectiveURL = workerURL ?? this.customWorkerURL;
    return createWorker(effectiveURL);
  }

  /**
   * Get the next request ID for this pool.
   *
   * @returns The next request ID
   * @internal
   */
  getNextRequestId(): number {
    return this.requestId++;
  }

  /**
   * Release a worker back to the pool.
   * For TransientWorkerPool, this terminates the worker immediately.
   *
   * @param worker - The worker to release
   * @internal
   */
  releaseWorker(worker: Worker): void {
    worker.terminate();
  }

  /**
   * Get the current number of workers in the pool.
   * For TransientWorkerPool, this is always 0 as workers are not kept alive.
   *
   * @returns Always 0
   */
  get size(): number {
    return 0;
  }

  /**
   * Check if the pool has reached its maximum capacity.
   * For TransientWorkerPool, this is always false as workers are transient.
   *
   * @returns Always false
   */
  isFull(): boolean {
    return false;
  }

  /**
   * Terminate all workers in the pool.
   * For TransientWorkerPool, this is a no-op as workers are not kept alive.
   */
  terminate(): void {
    // No-op: TransientWorkerPool doesn't keep workers alive
  }

  /**
   * Dispose of the worker pool.
   * For TransientWorkerPool, this is a no-op as workers are not kept alive.
   */
  [Symbol.dispose](): void {
    this.terminate();
  }
}
