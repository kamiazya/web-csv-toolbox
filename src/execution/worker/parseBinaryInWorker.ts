import type {
  CSVRecord,
  ParseBinaryOptions,
} from "../../common/types.ts";
import { createWorker } from "#execution/worker/createWorker.js";
import { addListener, removeListener } from "./workerUtils.ts";

let workerInstance: Worker | null = null;
let requestId = 0;

/**
 * Parse CSV binary in Worker thread.
 *
 * @internal
 * @param binary CSV binary to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function parseBinaryInWorker<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
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

    // Transfer binary data if it's ArrayBuffer
    const transferList =
      binary instanceof ArrayBuffer ? [binary] : [binary.buffer];

    worker.postMessage(
      {
        id,
        type: "parseBinary",
        data: binary,
        options,
        useWASM: false,
      },
      transferList,
    );
  });

  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}

/**
 * Parse CSV binary in Worker thread using WASM.
 *
 * @internal
 * @param binary CSV binary to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function parseBinaryInWorkerWASM<
  Header extends ReadonlyArray<string>,
>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
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

    const transferList =
      binary instanceof ArrayBuffer ? [binary] : [binary.buffer];

    worker.postMessage(
      {
        id,
        type: "parseBinary",
        data: binary,
        options,
        useWASM: true,
      },
      transferList,
    );
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
