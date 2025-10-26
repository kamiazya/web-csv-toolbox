import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { createWorker } from "#execution/worker/createWorker.js";
import { addListener, removeListener } from "./workerUtils.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";

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
  const worker = await getOrCreateWorker(options?.workerURL);
  const id = requestId++;

  // Check if we're in a browser environment that supports Transferable Streams
  const supportsTransferableStreams = typeof window !== "undefined" && "ReadableStream" in window;

  if (supportsTransferableStreams) {
    // Browser: Use Transferable Streams (zero-copy)
    const recordStream = await new Promise<ReadableStream<CSVRecord<Header>>>(
      (resolve, reject) => {
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

        // Transfer stream to worker (zero-copy)
        worker.postMessage(
          {
            id,
            type: "parseStream",
            data: stream,
            options,
          },
          [stream],
        );
      },
    );

    return convertStreamToAsyncIterableIterator(recordStream);
  } else {
    // Node.js: Collect stream into string, then send to worker
    const chunks: string[] = [];
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const csvString = chunks.join("");

    // Send as string data instead of stream
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
        data: csvString,
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
