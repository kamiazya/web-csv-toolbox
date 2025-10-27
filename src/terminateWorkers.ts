/**
 * Terminate all worker instances.
 *
 * This function terminates the singleton worker instance created by the parsing functions.
 * Call this when you're done using worker execution to clean up resources and
 * allow the process to exit cleanly.
 *
 * @example
 * ```ts
 * import { parseString, terminateWorkers } from 'web-csv-toolbox';
 *
 * // Parse some CSV with worker
 * for await (const record of parseString(csv, { execution: ['worker'] })) {
 *   console.log(record);
 * }
 *
 * // Terminate workers when done
 * await terminateWorkers();
 * ```
 */
export async function terminateWorkers(): Promise<void> {
  // Terminate the singleton worker managed by WorkerManager
  const { terminateWorker } = await import(
    "./execution/worker/helpers/WorkerManager.ts"
  );
  terminateWorker();
}
