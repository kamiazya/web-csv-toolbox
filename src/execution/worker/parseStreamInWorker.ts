import { createWorker } from "#execution/worker/createWorker.js";
import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";
import { addListener, removeListener } from "./utils/workerUtils.ts";

let workerInstance: Worker | null = null;
let requestId = 0;

/**
 * Parse CSV stream in Worker thread.
 *
 * Note: In Node.js Worker Threads, ReadableStream transfer is not supported,
 * so we collect the stream into a string first then transfer the string.
 * In browsers, we can use Transferable Streams for zero-copy transfer.
 *
 * @internal
 * @param stream CSV string stream to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function parseStreamInWorker<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  // Use WorkerPool if provided, otherwise use module-level singleton
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getOrCreateWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : requestId++;

  // Check if we're in a browser environment that supports Transferable Streams
  const supportsTransferableStreams =
    typeof window !== "undefined" && "ReadableStream" in window;

  if (supportsTransferableStreams) {
    // Browser: Use Transferable Streams (zero-copy)
    const recordStream = await new Promise<ReadableStream<CSVRecord<Header>>>(
      (resolve, reject) => {
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

        // Transfer stream to worker (zero-copy)
        try {
          worker.postMessage(
            {
              id,
              type: "parseStream",
              data: stream,
              options: serializableOptions,
            },
            [stream],
          );
        } catch (error) {
          cleanup();
          reject(error);
        }
      },
    );

    return convertStreamToAsyncIterableIterator(recordStream);
  }
  // Node.js: Collect stream into string, then send to worker
  const chunks: string[] = [];
  const reader = stream.getReader();

  // AbortSignal handler for cancelling the stream
  const abortHandler = () => {
    void reader.cancel().catch(() => {
      // Ignore errors during cancellation
    });
  };

  try {
    // Check if already aborted before starting
    if (options?.signal?.aborted) {
      reader.releaseLock();
      throw new DOMException("Aborted", "AbortError");
    }

    // Register abort listener
    if (options?.signal) {
      options.signal.addEventListener("abort", abortHandler);
    }

    try {
      while (true) {
        // Check abort status before reading
        if (options?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      // Clean up abort listener
      if (options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const csvString = chunks.join("");

  // Send as string data instead of stream
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
      worker.postMessage({ id, type: "abort" });
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

    // Remove signal from options before sending (not serializable)
    const serializableOptions = options ? { ...options } : undefined;
    if (serializableOptions) {
      serializableOptions.signal = undefined;
    }

    try {
      worker.postMessage({
        id,
        type: "parseString",
        data: csvString,
        options: serializableOptions,
        useWASM: false,
      });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });

  // Convert array to async iterator
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
