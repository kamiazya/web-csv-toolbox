import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { createWorker } from "#execution/worker/createWorker.js";
import { addListener, removeListener } from "./workerUtils.ts";

let workerInstance: Worker | null = null;
let requestId = 0;

/**
 * Parse CSV string in Worker thread.
 *
 * @internal
 * @param csv CSV string to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function parseStringInWorker<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const worker = await getOrCreateWorker(options?.workerURL);
  const id = requestId++;

  const records = await new Promise<CSVRecord<Header>[]>((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.data.id === id) {
        removeListener(worker, "message", handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    };

    const errorHandler = (error: ErrorEvent) => {
      removeListener(worker, "error", errorHandler);
      reject(error);
    };

    addListener(worker, "message", handler);
    addListener(worker, "error", errorHandler);
    worker.postMessage({
      id,
      type: "parseString",
      data: csv,
      options,
      useWASM: false,
    });
  });

  // Convert array to async iterator
  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}

/**
 * Parse CSV string in Worker thread using WASM.
 *
 * @internal
 * @param csv CSV string to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function parseStringInWorkerWASM<
  Header extends ReadonlyArray<string>,
>(
  csv: string,
  options?: ParseOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const worker = await getOrCreateWorker(options?.workerURL);
  const id = requestId++;

  const records = await new Promise<CSVRecord<Header>[]>((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.data.id === id) {
        removeListener(worker, "message", handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    };

    const errorHandler = (error: ErrorEvent) => {
      removeListener(worker, "error", errorHandler);
      reject(error);
    };

    addListener(worker, "message", handler);
    addListener(worker, "error", errorHandler);
    worker.postMessage({
      id,
      type: "parseString",
      data: csv,
      options,
      useWASM: true,
    });
  });

  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}

async function getOrCreateWorker(workerURL?: string | URL): Promise<Worker> {
  if (!workerInstance) {
    workerInstance = await createWorker(workerURL);
  }
  return workerInstance!;
}

/**
 * Terminate the worker instance.
 *
 * @internal
 */
export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}
