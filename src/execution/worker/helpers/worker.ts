// Workaround for Vitest browser mode: ensure wrapDynamicImport is available
// See: https://github.com/vitest-dev/vitest/issues/6552
if (typeof globalThis !== "undefined") {
  // @ts-ignore - Vitest browser mode global
  if (!globalThis.__vitest_browser_runner__) {
    // @ts-ignore
    globalThis.__vitest_browser_runner__ = { wrapDynamicImport: (f) => f() };
  }
}

import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "../../../common/types.ts";

/**
 * Message types for Worker communication.
 * @internal
 */
interface ParseRequest {
  id: number;
  type: "parseString" | "parseBinary" | "parseStream" | "parseUint8ArrayStream" | "parseStringStream";
  data?:
    | string
    | Uint8Array
    | ArrayBuffer
    | ReadableStream<string>
    | ReadableStream<Uint8Array>;
  stream?: ReadableStream<string> | ReadableStream<Uint8Array>;
  options?: ParseOptions | ParseBinaryOptions<readonly string[]>;
  useWASM?: boolean;
  resultPort?: MessagePort;
}

interface ParseResponse {
  id: number;
  result?:
    | CSVRecord<readonly string[]>[]
    | ReadableStream<CSVRecord<readonly string[]>>;
  error?: string;
}

interface ParseStreamResponse {
  id: number;
  type: "record" | "done" | "error";
  record?: CSVRecord<readonly string[]>;
  error?: string;
}

/**
 * Get the worker context (self for Web Workers, parentPort for Node.js Worker Threads)
 * @internal
 */
const getWorkerContext = async () => {
  // @ts-ignore - Check if we're in a Web Worker context
  if (
    typeof self !== "undefined" &&
    typeof self.addEventListener === "function"
  ) {
    // @ts-ignore
    return { context: self, isNodeWorker: false };
  }
  // @ts-ignore - We're in Node.js Worker Threads
  const { parentPort } = await import("node:worker_threads");
  return { context: parentPort, isNodeWorker: true };
};

const workerContextPromise = getWorkerContext();

/**
 * Helper to stream records incrementally to avoid memory issues.
 * @internal
 */
const streamRecordsToMain = async (
  workerContext: any,
  id: number,
  records: AsyncIterableIterator<CSVRecord<readonly string[]>> | Iterable<CSVRecord<readonly string[]>>,
) => {
  try {
    for await (const record of records) {
      const response: ParseStreamResponse = {
        id,
        type: "record",
        record,
      };
      workerContext.postMessage(response);
    }
    // Send done signal
    const doneResponse: ParseStreamResponse = { id, type: "done" };
    workerContext.postMessage(doneResponse);
  } catch (error) {
    const errorResponse: ParseStreamResponse = {
      id,
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    workerContext.postMessage(errorResponse);
  }
};

/**
 * Helper to stream records to a MessagePort (for TransferableStream strategy).
 * @internal
 */
const streamRecordsToPort = async (
  port: MessagePort,
  records: AsyncIterableIterator<CSVRecord<readonly string[]>> | Iterable<CSVRecord<readonly string[]>>,
) => {
  try {
    for await (const record of records) {
      port.postMessage({
        type: "record",
        record,
      });
    }
    // Send done signal
    port.postMessage({ type: "done" });
  } catch (error) {
    port.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Worker message handler for CSV parsing.
 * Handles different parsing strategies (regular, WASM, streaming).
 *
 * @internal
 */
const createMessageHandler = (workerContext: any, isNodeWorker: boolean) => {
  return async (event: MessageEvent<ParseRequest> | ParseRequest) => {
    // In Node.js Worker Threads, the message is passed directly, not wrapped in event.data
    const { id, type, data, stream, options, useWASM, resultPort } = isNodeWorker
      ? (event as ParseRequest)
      : (event as MessageEvent<ParseRequest>).data;

    try {
      // Handle TransferableStream strategy (stream + resultPort)
      if (resultPort && stream) {
        if (type === "parseStringStream" && stream instanceof ReadableStream) {
          // Process string stream with TransferableStream strategy
          const { LexerTransformer } = await import("../../../LexerTransformer.ts");
          const { RecordAssemblerTransformer } = await import(
            "../../../RecordAssemblerTransformer.ts"
          );
          const { convertStreamToAsyncIterableIterator } = await import(
            "../../../utils/convertStreamToAsyncIterableIterator.ts"
          );

          const resultStream = (stream as ReadableStream<string>)
            .pipeThrough(new LexerTransformer(options))
            .pipeThrough(new RecordAssemblerTransformer(options));

          await streamRecordsToPort(
            resultPort,
            convertStreamToAsyncIterableIterator(resultStream),
          );
          return;
        }

        if (type === "parseUint8ArrayStream" && stream instanceof ReadableStream) {
          // Process binary stream with TransferableStream strategy
          const { LexerTransformer } = await import("../../../LexerTransformer.ts");
          const { RecordAssemblerTransformer } = await import(
            "../../../RecordAssemblerTransformer.ts"
          );

          const binaryOptions = options as ParseBinaryOptions<readonly string[]>;
          const { charset, fatal, ignoreBOM, decomposition } = binaryOptions ?? {};

          // Convert binary stream to text stream then parse
          const textStream = decomposition
            ? (stream as ReadableStream<Uint8Array>)
                .pipeThrough(
                  new DecompressionStream(
                    decomposition,
                  ) as unknown as TransformStream<Uint8Array, Uint8Array>,
                )
                .pipeThrough(
                  new TextDecoderStream(charset ?? "utf-8", {
                    fatal,
                    ignoreBOM,
                  }) as unknown as TransformStream<Uint8Array, string>,
                )
            : (stream as ReadableStream<Uint8Array>).pipeThrough(
                new TextDecoderStream(charset ?? "utf-8", {
                  fatal,
                  ignoreBOM,
                }) as unknown as TransformStream<Uint8Array, string>,
              );

          const { convertStreamToAsyncIterableIterator } = await import(
            "../../../utils/convertStreamToAsyncIterableIterator.ts"
          );

          const resultStream = textStream
            .pipeThrough(new LexerTransformer(options))
            .pipeThrough(new RecordAssemblerTransformer(options));

          await streamRecordsToPort(
            resultPort,
            convertStreamToAsyncIterableIterator(resultStream),
          );
          return;
        }
      }

      // Handle traditional message-based strategies
      if (type === "parseString" && typeof data === "string") {
        if (useWASM) {
          // Dynamic import WASM implementation
          try {
            const { parseStringToArraySyncWASM } = await import(
              "../../../parseStringToArraySyncWASM.ts"
            );
            await streamRecordsToMain(workerContext, id, parseStringToArraySyncWASM(data, options));
            return;
          } catch (error) {
            // Fall back to regular parser if WASM is not available
            const { parseStringToIterableIterator } = await import(
              "../../../parseStringToIterableIterator.ts"
            );
            await streamRecordsToMain(workerContext, id, parseStringToIterableIterator(data, options));
            return;
          }
        } else {
          // Use regular parser with iterator
          const { parseStringToIterableIterator } = await import(
            "../../../parseStringToIterableIterator.ts"
          );
          await streamRecordsToMain(workerContext, id, parseStringToIterableIterator(data, options));
          return;
        }
      } else if (type === "parseStream" && data instanceof ReadableStream) {
        // Stream processing (WASM not supported for streams)
        const { LexerTransformer } = await import("../../../LexerTransformer.ts");
        const { RecordAssemblerTransformer } = await import(
          "../../../RecordAssemblerTransformer.ts"
        );
        const { convertStreamToAsyncIterableIterator } = await import(
          "../../../utils/convertStreamToAsyncIterableIterator.ts"
        );

        const resultStream = (data as ReadableStream<string>)
          .pipeThrough(new LexerTransformer(options))
          .pipeThrough(new RecordAssemblerTransformer(options));

        // Convert stream to async iterable and stream records incrementally
        await streamRecordsToMain(
          workerContext,
          id,
          convertStreamToAsyncIterableIterator(resultStream),
        );
        return;
      } else if (
        type === "parseUint8ArrayStream" &&
        data instanceof ReadableStream
      ) {
        // Binary stream processing
        const { LexerTransformer } = await import("../../../LexerTransformer.ts");
        const { RecordAssemblerTransformer } = await import(
          "../../../RecordAssemblerTransformer.ts"
        );

        const binaryOptions = options as ParseBinaryOptions<readonly string[]>;
        const { charset, fatal, ignoreBOM, decomposition } =
          binaryOptions ?? {};

        // Convert binary stream to text stream then parse
        const textStream = decomposition
          ? (data as ReadableStream<Uint8Array>)
              .pipeThrough(
                new DecompressionStream(
                  decomposition,
                ) as unknown as TransformStream<Uint8Array, Uint8Array>,
              )
              .pipeThrough(
                new TextDecoderStream(charset ?? "utf-8", {
                  fatal,
                  ignoreBOM,
                }) as unknown as TransformStream<Uint8Array, string>,
              )
          : (data as ReadableStream<Uint8Array>).pipeThrough(
              new TextDecoderStream(charset ?? "utf-8", {
                fatal,
                ignoreBOM,
              }) as unknown as TransformStream<Uint8Array, string>,
            );

        const { convertStreamToAsyncIterableIterator } = await import(
          "../../../utils/convertStreamToAsyncIterableIterator.ts"
        );

        const resultStream = textStream
          .pipeThrough(new LexerTransformer(options))
          .pipeThrough(new RecordAssemblerTransformer(options));

        // Convert stream to async iterable and stream records incrementally
        await streamRecordsToMain(
          workerContext,
          id,
          convertStreamToAsyncIterableIterator(resultStream),
        );
        return;
      } else if (type === "parseBinary") {
        const binary = data as Uint8Array | ArrayBuffer;

        if (useWASM) {
          // Convert (and optionally decompress) then use WASM
          try {
            const {
              charset = "utf-8",
              fatal,
              ignoreBOM,
              decomposition,
            } = (options as ParseBinaryOptions<readonly string[]>) ?? {};
            const asBytes =
              binary instanceof Uint8Array ? binary : new Uint8Array(binary);
            let decoded: string;
            if (decomposition) {
              // Check for DecompressionStream support (may not be available in all Worker contexts)
              if (typeof DecompressionStream === "undefined") {
                throw new Error(
                  "DecompressionStream is not available in this worker context. " +
                    "Decompress the data on the main thread before passing to worker.",
                );
              }
              const decompressed = await new Response(
                new ReadableStream<Uint8Array>({
                  start(c) {
                    c.enqueue(asBytes);
                    c.close();
                  },
                }).pipeThrough(
                  new DecompressionStream(
                    decomposition,
                  ) as unknown as TransformStream<Uint8Array, Uint8Array>,
                ),
              ).arrayBuffer();
              decoded = new TextDecoder(charset, { fatal, ignoreBOM }).decode(
                decompressed,
              );
            } else {
              decoded = new TextDecoder(charset, { fatal, ignoreBOM }).decode(
                asBytes,
              );
            }
            const { parseStringToArraySyncWASM } = await import(
              "../../../parseStringToArraySyncWASM.ts"
            );
            await streamRecordsToMain(workerContext, id, parseStringToArraySyncWASM(decoded, options));
            return;
          } catch (error) {
            // Fall back to regular parser if WASM is not available
            const { parseBinaryToIterableIterator } = await import(
              "../../../parseBinaryToIterableIterator.ts"
            );
            await streamRecordsToMain(workerContext, id, parseBinaryToIterableIterator(binary, options));
            return;
          }
        } else {
          // Use regular binary parser with iterator
          const { parseBinaryToIterableIterator } = await import(
            "../../../parseBinaryToIterableIterator.ts"
          );
          await streamRecordsToMain(workerContext, id, parseBinaryToIterableIterator(binary, options));
          return;
        }
      } else {
        throw new Error(`Unsupported parse type: ${type}`);
      }
    } catch (error) {
      const errorResponse: ParseStreamResponse = {
        id,
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
      // @ts-ignore
      workerContext.postMessage(errorResponse);
    }
  };
};

// Initialize worker and register message handler
workerContextPromise.then(({ context: workerContext, isNodeWorker }) => {
  const messageHandler = createMessageHandler(workerContext, isNodeWorker);

  if (isNodeWorker) {
    // @ts-ignore - Node.js Worker Threads use 'on' method
    workerContext.on("message", messageHandler);
  } else {
    // @ts-ignore - Web Workers use addEventListener
    workerContext.addEventListener("message", messageHandler);
  }
});
