/**
 * Terminate all worker instances.
 *
 * This function terminates all worker instances created by the parsing functions.
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
  // Dynamically import and terminate each worker type
  // This avoids loading worker modules if they haven't been used

  // Note: We use dynamic imports to avoid loading modules that haven't been used
  // The imports will fail silently if the modules haven't been loaded yet

  await Promise.all([
    import("./execution/worker/parseStringInWorker.ts")
      .then((m) => m.terminateWorker())
      .catch(() => {}),
    import("./execution/worker/parseBinaryInWorker.ts")
      .then((m) => m.terminateWorker())
      .catch(() => {}),
    import("./execution/worker/parseStreamInWorker.ts")
      .then((m) => m.terminateWorker())
      .catch(() => {}),
    import("./execution/worker/parseUint8ArrayStreamInWorker.ts")
      .then((m) => m.terminateWorker())
      .catch(() => {}),
  ]);
}
