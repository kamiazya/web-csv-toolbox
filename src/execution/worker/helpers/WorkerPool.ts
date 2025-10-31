/**
 * Common interface for worker pools.
 * Both ReusableWorkerPool and TransientWorkerPool implement this interface.
 *
 * @remarks
 * This interface defines the contract for worker pool implementations.
 * Users typically use {@link ReusableWorkerPool} for persistent worker pools,
 * while the internal default pool uses {@link TransientWorkerPool} for automatic cleanup.
 */
export interface WorkerPool {
  /**
   * Get a worker instance from the pool.
   *
   * @param workerURL - Optional custom worker URL
   * @returns A worker instance
   */
  getWorker(workerURL?: string | URL): Promise<Worker>;

  /**
   * Get the next request ID for this pool.
   *
   * @returns The next request ID
   */
  getNextRequestId(): number;

  /**
   * Release a worker back to the pool.
   *
   * @param worker - The worker to release
   */
  releaseWorker(worker: Worker): void;

  /**
   * Get the current number of workers in the pool.
   *
   * @returns The number of active workers
   */
  readonly size: number;

  /**
   * Check if the pool has reached its maximum capacity.
   *
   * @returns True if the pool is at maximum capacity, false otherwise
   */
  isFull(): boolean;

  /**
   * Terminate all workers in the pool and clean up resources.
   */
  terminate(): void;

  /**
   * Dispose of the worker pool, terminating all workers.
   */
  [Symbol.dispose](): void;
}
