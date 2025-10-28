import { createWorker } from "#execution/worker/createWorker.js";
import type { WorkerPool } from "./WorkerPool.ts";

/**
 * Options for configuring the ReusableWorkerPool.
 */
export interface ReusableWorkerPoolOptions {
  /**
   * Maximum number of worker instances in the pool.
   *
   * @default 1
   *
   * @remarks
   * **Security Recommendation:**
   * For production applications that accept user uploads, set this to a reasonable limit (e.g., 2-4)
   * to prevent resource exhaustion attacks. Without limits, malicious users could spawn unlimited
   * workers by uploading multiple large CSV files simultaneously, leading to memory exhaustion and DoS.
   *
   * @example
   * ```ts
   * // Recommended for production
   * const pool = new ReusableReusableWorkerPool({ maxWorkers: 4 });
   * ```
   */
  maxWorkers?: number;

  /**
   * Custom worker URL to use for all workers in the pool.
   */
  workerURL?: string | URL;
}

/**
 * A pool that manages multiple worker instances with automatic cleanup and load balancing.
 *
 * This class implements the Disposable interface, allowing automatic
 * worker termination when the pool goes out of scope using the `using` syntax.
 *
 * @remarks
 * **⚠️ Security: Resource Protection**
 *
 * When building applications that accept user-uploaded CSV files, it is **strongly recommended**
 * to use `ReusableWorkerPool` with a limited `maxWorkers` setting to protect against resource exhaustion attacks.
 *
 * **Why this matters:**
 * - Attackers can upload multiple large CSV files simultaneously to overwhelm your application
 * - Without `ReusableWorkerPool` limits, each request could spawn unlimited workers
 * - This leads to excessive memory consumption, CPU exhaustion, and potential DoS
 *
 * **Recommended settings:**
 * - Web applications: `maxWorkers: 2-4`
 * - Server applications: `Math.min(4, os.cpus().length)`
 * - High-security environments: `maxWorkers: 1`
 *
 * See {@link https://github.com/kamiazya/web-csv-toolbox/blob/main/SECURITY.md | SECURITY.md} for detailed security guidelines.
 *
 * @example Basic usage with automatic cleanup (single worker)
 * ```ts
 * import { ReusableWorkerPool, parseString } from 'web-csv-toolbox';
 *
 * async function processCSV(csv: string) {
 *   using pool = new ReusableWorkerPool();
 *
 *   const records = [];
 *   for await (const record of parseString(csv, {
 *     execution: ['worker'],
 *     workerPool: pool
 *   })) {
 *     records.push(record);
 *   }
 *
 *   return records;
 *   // Worker is automatically terminated when leaving this scope
 * }
 * ```
 *
 * @example Parallel processing with multiple workers
 * ```ts
 * import { ReusableWorkerPool, parseString } from 'web-csv-toolbox';
 *
 * async function processMultipleCSVs(csvFiles: string[]) {
 *   using pool = new ReusableWorkerPool({ maxWorkers: 4 });
 *
 *   // Process all CSV files in parallel
 *   const results = await Promise.all(
 *     csvFiles.map(async (csv) => {
 *       const records = [];
 *       for await (const record of parseString(csv, {
 *         execution: ['worker'],
 *         workerPool: pool
 *       })) {
 *         records.push(record);
 *       }
 *       return records;
 *     })
 *   );
 *
 *   return results;
 *   // All workers are automatically terminated when leaving this scope
 * }
 * ```
 *
 * @example Manual cleanup (if not using `using` syntax)
 * ```ts
 * import { ReusableWorkerPool, parseString } from 'web-csv-toolbox';
 *
 * async function processCSV(csv: string) {
 *   const pool = new ReusableWorkerPool({ maxWorkers: 2 });
 *
 *   try {
 *     const records = [];
 *     for await (const record of parseString(csv, {
 *       execution: ['worker'],
 *       workerPool: pool
 *     })) {
 *       records.push(record);
 *     }
 *     return records;
 *   } finally {
 *     pool[Symbol.dispose]();
 *   }
 * }
 * ```
 */
export class ReusableWorkerPool implements WorkerPool, Disposable {
  private workers: Worker[] = [];
  private requestId = 0;
  private currentWorkerIndex = 0;
  private readonly maxWorkers: number;
  private readonly customWorkerURL?: string | URL;
  private pendingWorkerCreations: Map<number, Promise<Worker>> = new Map();

  /**
   * Create a new ReusableWorkerPool.
   *
   * @param options - Configuration options for the pool
   */
  constructor(options: ReusableWorkerPoolOptions = {}) {
    this.maxWorkers = options.maxWorkers ?? 1;
    this.customWorkerURL = options.workerURL;

    if (this.maxWorkers < 1) {
      throw new Error("maxWorkers must be at least 1");
    }
  }

  /**
   * Get a worker instance from the pool using round-robin load balancing.
   *
   * @param workerURL - Optional custom worker URL (overrides pool's workerURL)
   * @returns A worker instance from the pool
   * @internal
   */
  async getWorker(workerURL?: string | URL): Promise<Worker> {
    const effectiveURL = workerURL ?? this.customWorkerURL;

    // Calculate total workers including pending creations
    const totalWorkers = this.workers.length + this.pendingWorkerCreations.size;

    // If pool is not yet full, create a new worker
    if (totalWorkers < this.maxWorkers) {
      // Use the next worker index as the key for pending creation
      const workerIndex = this.workers.length + this.pendingWorkerCreations.size;

      // Check if this worker is already being created
      const existingCreation = this.pendingWorkerCreations.get(workerIndex);
      if (existingCreation) {
        return existingCreation;
      }

      // Create a new worker and cache the promise
      const workerPromise = createWorker(effectiveURL).then((worker) => {
        this.workers.push(worker);
        this.pendingWorkerCreations.delete(workerIndex);
        return worker;
      }).catch((error) => {
        // Clean up on error
        this.pendingWorkerCreations.delete(workerIndex);
        throw error;
      });

      this.pendingWorkerCreations.set(workerIndex, workerPromise);
      return workerPromise;
    }

    // Wait for any pending worker creations to complete
    if (this.pendingWorkerCreations.size > 0) {
      const pendingWorker = Array.from(this.pendingWorkerCreations.values())[0];
      await pendingWorker;
    }

    // Use round-robin to select a worker
    const worker = this.workers[this.currentWorkerIndex];
    this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;
    return worker;
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
   * For ReusableWorkerPool, this does nothing as workers are kept alive and reused.
   *
   * @param _worker - The worker to release
   * @internal
   */
  releaseWorker(_worker: Worker): void {
    // ReusableWorkerPool keeps workers alive for reuse
  }

  /**
   * Get the current number of workers in the pool.
   *
   * @returns The number of active workers
   */
  get size(): number {
    return this.workers.length;
  }

  /**
   * Check if the pool has reached its maximum capacity.
   *
   * @returns True if the pool is at maximum capacity, false otherwise
   *
   * @remarks
   * This method is useful for implementing early rejection of requests
   * when the worker pool is saturated, preventing resource exhaustion.
   *
   * @example
   * ```ts
   * import { Hono } from 'hono';
   * import { ReusableWorkerPool } from 'web-csv-toolbox';
   *
   * const pool = new ReusableWorkerPool({ maxWorkers: 4 });
   *
   * app.post('/validate-csv', async (c) => {
   *   // Early rejection if pool is saturated
   *   if (pool.isFull()) {
   *     return c.json({ error: 'Service busy, please try again later' }, 503);
   *   }
   *
   *   // Process CSV...
   * });
   * ```
   */
  isFull(): boolean {
    const totalWorkers = this.workers.length + this.pendingWorkerCreations.size;
    return totalWorkers >= this.maxWorkers;
  }

  /**
   * Terminate all workers in the pool and clean up resources.
   *
   * This method should be called when the pool is no longer needed,
   * typically during application shutdown.
   *
   * @example
   * ```ts
   * const pool = new ReusableWorkerPool({ maxWorkers: 4 });
   *
   * // When shutting down
   * pool.terminate();
   * ```
   *
   * @example With Hono
   * ```ts
   * import { Hono } from 'hono';
   * import { ReusableWorkerPool } from 'web-csv-toolbox';
   *
   * const app = new Hono();
   * const pool = new ReusableWorkerPool({ maxWorkers: 4 });
   *
   * app.onShutdown(() => {
   *   pool.terminate();
   * });
   * ```
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.currentWorkerIndex = 0;
    this.pendingWorkerCreations.clear();
  }

  /**
   * Dispose of the worker pool, terminating all workers.
   *
   * This method is called automatically when using the `using` syntax.
   * For manual cleanup, use {@link terminate} instead.
   *
   * @example With `using` syntax (automatic cleanup)
   * ```ts
   * using pool = new ReusableWorkerPool({ maxWorkers: 4 });
   * // Workers are automatically terminated when leaving scope
   * ```
   *
   * @example Manual cleanup
   * ```ts
   * const pool = new ReusableWorkerPool({ maxWorkers: 4 });
   * try {
   *   // Use pool
   * } finally {
   *   pool.terminate(); // Preferred over pool[Symbol.dispose]()
   * }
   * ```
   */
  [Symbol.dispose](): void {
    this.terminate();
  }
}
