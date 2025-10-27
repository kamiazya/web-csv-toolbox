import { createWorker } from "#execution/worker/createWorker.js";

/**
 * Options for configuring the WorkerPool.
 */
export interface WorkerPoolOptions {
  /**
   * Maximum number of worker instances in the pool.
   * @default 1
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
 * @example Basic usage with automatic cleanup (single worker)
 * ```ts
 * import { WorkerPool, parseString } from 'web-csv-toolbox';
 *
 * async function processCSV(csv: string) {
 *   using pool = new WorkerPool();
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
 * import { WorkerPool, parseString } from 'web-csv-toolbox';
 *
 * async function processMultipleCSVs(csvFiles: string[]) {
 *   using pool = new WorkerPool({ maxWorkers: 4 });
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
 * import { WorkerPool, parseString } from 'web-csv-toolbox';
 *
 * async function processCSV(csv: string) {
 *   const pool = new WorkerPool({ maxWorkers: 2 });
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
export class WorkerPool implements Disposable {
  private workers: Worker[] = [];
  private requestId = 0;
  private currentWorkerIndex = 0;
  private readonly maxWorkers: number;
  private readonly customWorkerURL?: string | URL;

  /**
   * Create a new WorkerPool.
   *
   * @param options - Configuration options for the pool
   */
  constructor(options: WorkerPoolOptions = {}) {
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

    // If pool is not yet full, create a new worker
    if (this.workers.length < this.maxWorkers) {
      const worker = await createWorker(effectiveURL);
      this.workers.push(worker);
      return worker;
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
   * Get the current number of workers in the pool.
   *
   * @returns The number of active workers
   */
  get size(): number {
    return this.workers.length;
  }

  /**
   * Dispose of the worker pool, terminating all workers.
   *
   * This method is called automatically when using the `using` syntax,
   * or can be called manually for explicit cleanup.
   */
  [Symbol.dispose](): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.currentWorkerIndex = 0;
  }
}
