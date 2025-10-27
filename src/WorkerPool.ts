import { createWorker } from "#execution/worker/createWorker.js";

/**
 * A pool that manages a single worker instance with automatic cleanup.
 *
 * This class implements the Disposable interface, allowing automatic
 * worker termination when the pool goes out of scope using the `using` syntax.
 *
 * @example Basic usage with automatic cleanup
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
 * @example Processing multiple CSVs with the same worker
 * ```ts
 * import { WorkerPool, parseString } from 'web-csv-toolbox';
 *
 * async function processMultipleCSVs(csvFiles: string[]) {
 *   using pool = new WorkerPool();
 *
 *   const allResults = [];
 *   for (const csv of csvFiles) {
 *     const records = [];
 *     for await (const record of parseString(csv, {
 *       execution: ['worker'],
 *       workerPool: pool
 *     })) {
 *       records.push(record);
 *     }
 *     allResults.push(records);
 *   }
 *
 *   return allResults;
 *   // Single worker handles all CSVs, then terminates
 * }
 * ```
 *
 * @example Manual cleanup (if not using `using` syntax)
 * ```ts
 * import { WorkerPool, parseString } from 'web-csv-toolbox';
 *
 * async function processCSV(csv: string) {
 *   const pool = new WorkerPool();
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
  private worker: Worker | null = null;
  private requestId = 0;

  /**
   * Get or create the worker instance.
   *
   * @param workerURL - Optional custom worker URL
   * @returns The worker instance
   * @internal
   */
  async getWorker(workerURL?: string | URL): Promise<Worker> {
    if (!this.worker) {
      this.worker = await createWorker(workerURL);
    }
    return this.worker;
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
   * Dispose of the worker pool, terminating the worker if it exists.
   *
   * This method is called automatically when using the `using` syntax,
   * or can be called manually for explicit cleanup.
   */
  [Symbol.dispose](): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
