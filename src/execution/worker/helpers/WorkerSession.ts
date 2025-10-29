import { createWorker } from "#execution/worker/createWorker.js";
import type { WorkerPool } from "./WorkerPool.ts";

/**
 * Options for creating a WorkerSession.
 */
export interface WorkerSessionOptions {
  /**
   * Custom worker URL.
   */
  workerURL?: string | URL;

  /**
   * Worker pool for reusable workers.
   */
  workerPool?: WorkerPool;
}

/**
 * WorkerSession manages the lifecycle of a single worker instance.
 *
 * Hybrid approach:
 * - If workerPool is provided: Use pool's worker (reusable, manual pool cleanup)
 * - If workerPool is NOT provided: Create disposable worker (auto-cleanup on dispose)
 *
 * Use `using` syntax for automatic cleanup:
 * ```typescript
 * using session = await WorkerSession.create();
 * const records = await sendWorkerMessage(session, { ... });
 * // Worker is automatically terminated when leaving scope (if disposable)
 * ```
 *
 * @example Disposable worker (one-time use)
 * ```typescript
 * using session = await WorkerSession.create();
 * const records = await sendWorkerMessage(session.getWorker(), {
 *   id: session.getNextRequestId(),
 *   type: "parseString",
 *   data: csv,
 *   options: serializeOptions(options),
 * });
 * // Worker automatically terminated
 * ```
 *
 * @example With WorkerPool (reusable)
 * ```typescript
 * using pool = new WorkerPool({ maxWorkers: 3 });
 * using session = await WorkerSession.create({ workerPool: pool });
 * const records1 = await sendWorkerMessage(session.getWorker(), { ... });
 * const records2 = await sendWorkerMessage(session.getWorker(), { ... });
 * // Worker returned to pool, pool cleanup happens when pool disposes
 * ```
 */
export class WorkerSession implements Disposable {
  private worker: Worker;
  private requestIdCounter = 0;
  private readonly workerPool?: WorkerPool;

  private constructor(
    worker: Worker,
    workerPool?: WorkerPool,
  ) {
    this.worker = worker;
    this.workerPool = workerPool;
  }

  /**
   * Create a new WorkerSession.
   *
   * @param options Session options
   * @returns Promise that resolves to a WorkerSession instance
   */
  static async create(options?: WorkerSessionOptions): Promise<WorkerSession> {
    let worker: Worker;
    if (options?.workerPool) {
      // Use worker from pool
      worker = await options.workerPool.getWorker(options.workerURL);
      return new WorkerSession(worker, options.workerPool);
    } else {
      // Create disposable worker
      worker = await createWorker(options?.workerURL);
      return new WorkerSession(worker);
    }
  }

  /**
   * Get the worker instance.
   */
  getWorker(): Worker {
    return this.worker;
  }

  /**
   * Get the next request ID for this session.
   * - If using WorkerPool: Delegates to pool's getNextRequestId()
   * - If disposable: Uses internal counter
   */
  getNextRequestId(): number {
    if (this.workerPool) {
      return this.workerPool.getNextRequestId();
    }
    return this.requestIdCounter++;
  }

  /**
   * Dispose the session.
   * - If using a pool: Releases the worker back to the pool (behavior depends on pool type)
   * - If disposable: Terminates the worker
   */
  [Symbol.dispose](): void {
    if (this.workerPool) {
      this.workerPool.releaseWorker(this.worker);
    } else {
      this.worker.terminate();
    }
  }
}
