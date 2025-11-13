import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "../../core/constants.ts";
import type {
  CSVBinary,
  ParseBinaryOptions,
  ParseOptions,
} from "../../core/types.ts";
import { WorkerSession } from "../../worker/helpers/WorkerSession.ts";
import { serializeOptions } from "../../worker/utils/serializeOptions.ts";
import type { InternalEngineConfig } from "../config/InternalEngineConfig.ts";
import type { WorkerStrategy } from "./WorkerStrategy.ts";

/**
 * TransferableStream-based strategy.
 *
 * Streams are transferred directly to the worker using zero-copy transfer.
 * This is more efficient than message-streaming but only supported in
 * Chrome, Firefox, and Edge (not Safari).
 *
 * @internal
 */
export class TransferableStreamStrategy implements WorkerStrategy {
  readonly name = "stream-transfer";

  async *execute<
    T,
    Header extends ReadonlyArray<string> = readonly string[],
    Delimiter extends string = DEFAULT_DELIMITER,
    Quotation extends string = DEFAULT_QUOTATION,
  >(
    input: string | CSVBinary | ReadableStream<string>,
    options:
      | ParseOptions<Header, Delimiter, Quotation>
      | ParseBinaryOptions<Header, Delimiter, Quotation>
      | undefined,
    session: WorkerSession | null,
    engineConfig: InternalEngineConfig,
  ): AsyncIterableIterator<T> {
    // Use provided session or create a new one
    const useProvidedSession = session !== null;
    const workerSession =
      session ??
      (await WorkerSession.create({
        workerPool: engineConfig.workerPool,
        workerURL: engineConfig.workerURL,
      }));

    try {
      const worker = workerSession.getWorker();
      const id = workerSession.getNextRequestId();

      // Ensure input is a ReadableStream
      if (!(input instanceof ReadableStream)) {
        throw new Error(
          `TransferableStreamStrategy requires ReadableStream input, got ${typeof input}`,
        );
      }

      // Check abort status before acquiring reader
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // Determine stream type based on the input stream
      let type: string;
      let streamToTransfer: ReadableStream;

      // Check if this is a string stream or binary stream
      // We need to inspect the stream to determine type
      // For now, we'll use heuristics based on common stream types
      const reader = input.getReader();
      let readerReleased = false;

      try {
        const firstChunk = await reader.read();

        if (firstChunk.done) {
          // Empty stream - release the reader and return
          reader.releaseLock();
          readerReleased = true;
          return;
        }

        // Put the first chunk back by creating a new stream
        const reconstructedStream = new ReadableStream({
          start(controller) {
            controller.enqueue(firstChunk.value);
          },
          pull(controller) {
            reader
              .read()
              .then(({ done, value }) => {
                if (done) {
                  controller.close();
                } else {
                  controller.enqueue(value);
                }
              })
              .catch((error) => controller.error(error));
          },
          cancel(reason) {
            return reader.cancel(reason).finally(() => {
              // Ensure reader lock is released on cancellation
              if (!readerReleased) {
                try {
                  reader.releaseLock();
                  readerReleased = true;
                } catch {
                  // Lock may already be released
                }
              }
            });
          },
        });

        // Determine type based on first chunk
        if (typeof firstChunk.value === "string") {
          type = "parseStringStream";
          streamToTransfer = reconstructedStream;
        } else if (firstChunk.value instanceof Uint8Array) {
          type = "parseUint8ArrayStream";
          streamToTransfer = reconstructedStream;
        } else {
          throw new Error(
            `Unsupported stream chunk type: ${typeof firstChunk.value}`,
          );
        }

        // Create a MessageChannel for receiving results
        const channel = new MessageChannel();
        const resultPort = channel.port1;
        const workerPort = channel.port2;

        // Send the stream and worker port to the worker
        worker.postMessage(
          {
            id,
            type,
            stream: streamToTransfer,
            options: serializeOptions(options),
            useWASM: engineConfig.hasWasm(),
            resultPort: workerPort,
          },
          [streamToTransfer as any, workerPort],
        );

        // Listen for results from the worker
        yield* this.receiveResults<T>(resultPort, options?.signal);
      } catch (error) {
        // Release reader lock if not already released
        if (!readerReleased) {
          try {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
            readerReleased = true;
          } catch {
            // Lock may already be released
          }
        }
        throw error;
      }
    } finally {
      // Dispose session only if we created it
      if (!useProvidedSession) {
        workerSession[Symbol.dispose]();
      }
    }
  }

  /**
   * Receive parsed records from the worker via MessageChannel.
   *
   * @param port - MessagePort to receive results from
   * @param signal - Optional AbortSignal for cancellation
   */
  private async *receiveResults<T>(
    port: MessagePort,
    signal?: AbortSignal,
  ): AsyncIterableIterator<T> {
    const queue: T[] = [];
    let done = false;
    let error: Error | null = null;
    let resolveNext: (() => void) | null = null;

    // Set up abort handling
    const abortHandler = () => {
      error = new DOMException("Aborted", "AbortError");
      if (resolveNext) resolveNext();
      port.close();
    };

    if (signal) {
      if (signal.aborted) {
        port.close();
        throw new DOMException("Aborted", "AbortError");
      }
      signal.addEventListener("abort", abortHandler);
    }

    // Set up message handler
    port.onmessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "record") {
        queue.push(message.record);
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
      } else if (message.type === "done") {
        done = true;
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
        port.close();
      } else if (message.type === "error") {
        error = new Error(message.error);
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
        port.close();
      }
    };

    port.onmessageerror = (event: MessageEvent) => {
      error = new Error(`Message deserialization error: ${event.data}`);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
      port.close();
    };

    // Start the port
    port.start();

    try {
      // Yield records as they arrive
      while (!done && !error) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          // Wait for next message
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
        }
      }

      // Yield any remaining records
      while (queue.length > 0) {
        yield queue.shift()!;
      }

      // Throw error if one occurred
      if (error) {
        throw error;
      }
    } finally {
      if (signal) {
        signal.removeEventListener("abort", abortHandler);
      }
      port.close();
    }
  }
}
