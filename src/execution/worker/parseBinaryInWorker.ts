import { createWorker } from "#execution/worker/createWorker.js";
import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
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
  // Use WorkerPool if provided, otherwise use module-level singleton
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getOrCreateWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : requestId++;

  const records = await new Promise<CSVRecord<Header>[]>((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.data.id === id) {
        cleanup();
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    };

    const errorHandler = (error: ErrorEvent) => {
      cleanup();
      reject(error);
    };

    const abortHandler = () => {
      cleanup();
      try {
        worker.postMessage({ id, type: "abort" });
      } catch {
        // Ignore errors if worker is already terminated
      }
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      removeListener(worker, "message", handler);
      removeListener(worker, "error", errorHandler);
      if (options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    };

    addListener(worker, "message", handler);
    addListener(worker, "error", errorHandler);

    // Wire abort signal if present
    if (options?.signal) {
      if (options.signal.aborted) {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", abortHandler);
    }

    // Extract non-serializable fields before sending to worker
    const {
      signal: _signal,
      workerPool: _workerPool,
      workerURL: _workerURL,
      ...serializableOptions
    } = options ?? {};

    // Transfer binary data if it's ArrayBuffer
    const transferList =
      binary instanceof ArrayBuffer ? [binary] : [binary.buffer];

    try {
      worker.postMessage(
        {
          id,
          type: "parseBinary",
          data: binary,
          options: serializableOptions,
          useWASM: false,
        },
        transferList,
      );
    } catch (error) {
      cleanup();
      reject(error);
    }
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
  // Use WorkerPool if provided, otherwise use module-level singleton
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getOrCreateWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : requestId++;

  const records = await new Promise<CSVRecord<Header>[]>((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.data.id === id) {
        cleanup();
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      }
    };

    const errorHandler = (error: ErrorEvent) => {
      cleanup();
      reject(error);
    };

    const abortHandler = () => {
      cleanup();
      try {
        worker.postMessage({ id, type: "abort" });
      } catch {
        // Ignore errors if worker is already terminated
      }
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      removeListener(worker, "message", handler);
      removeListener(worker, "error", errorHandler);
      if (options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    };

    addListener(worker, "message", handler);
    addListener(worker, "error", errorHandler);

    // Wire abort signal if present
    if (options?.signal) {
      if (options.signal.aborted) {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", abortHandler);
    }

    // Extract non-serializable fields before sending to worker
    const {
      signal: _signal,
      workerPool: _workerPool,
      workerURL: _workerURL,
      ...serializableOptions
    } = options ?? {};

    const transferList =
      binary instanceof ArrayBuffer ? [binary] : [binary.buffer];

    try {
      worker.postMessage(
        {
          id,
          type: "parseBinary",
          data: binary,
          options: serializableOptions,
          useWASM: true,
        },
        transferList,
      );
    } catch (error) {
      cleanup();
      reject(error);
    }
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
