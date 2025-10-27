import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { createWorker } from "#execution/worker/createWorker.js";
import { addListener, removeListener } from "./workerUtils.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";

let workerInstance: Worker | null = null;
let requestId = 0;

/**
 * Parse CSV Uint8Array stream in Worker thread.
 *
 * Note: In Node.js Worker Threads, ReadableStream transfer is not supported,
 * so we collect the stream into an array first then transfer the array.
 * In browsers, we can use Transferable Streams for zero-copy transfer.
 *
 * @internal
 * @param stream CSV Uint8Array stream to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function parseUint8ArrayStreamInWorker<
  Header extends ReadonlyArray<string>,
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
    // Use WorkerPool if provided, otherwise use module-level singleton
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getOrCreateWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : requestId++;

  // Check if we're in a browser environment that supports Transferable Streams
  const supportsTransferableStreams = typeof window !== "undefined" && "ReadableStream" in window;

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
          delete serializableOptions.signal;
        }

        // Transfer stream to worker (zero-copy)
        try {
          worker.postMessage(
            {
              id,
              type: "parseUint8ArrayStream",
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
  } else {
    // Node.js: Collect stream into chunks array, then send to worker
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Copy the chunk to avoid detached buffer issues
        // Create a new Uint8Array from the array of values
        chunks.push(Uint8Array.from(value));
      }
    } finally {
      reader.releaseLock();
    }

    // Concatenate all chunks into a single Uint8Array
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Send as binary data instead of stream
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
        delete serializableOptions.signal;
      }

      try {
        worker.postMessage({
          id,
          type: "parseBinary",
          data: combined,
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
