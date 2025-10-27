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
  type: "parseString" | "parseBinary" | "parseStream" | "parseUint8ArrayStream";
  data:
    | string
    | Uint8Array
    | ArrayBuffer
    | ReadableStream<string>
    | ReadableStream<Uint8Array>;
  options?: ParseOptions | ParseBinaryOptions<readonly string[]>;
  useWASM?: boolean;
}

interface ParseResponse {
  id: number;
  result?:
    | CSVRecord<readonly string[]>[]
    | ReadableStream<CSVRecord<readonly string[]>>;
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
 * Worker message handler for CSV parsing.
 * Handles different parsing strategies (regular, WASM, streaming).
 *
 * @internal
 */
const createMessageHandler = (workerContext: any, isNodeWorker: boolean) => {
  return async (event: MessageEvent<ParseRequest> | ParseRequest) => {
    // In Node.js Worker Threads, the message is passed directly, not wrapped in event.data
    const { id, type, data, options, useWASM } = isNodeWorker
      ? (event as ParseRequest)
      : (event as MessageEvent<ParseRequest>).data;

    try {
      let result:
        | CSVRecord<readonly string[]>[]
        | ReadableStream<CSVRecord<readonly string[]>>;

      if (type === "parseString" && typeof data === "string") {
        if (useWASM) {
          // Dynamic import WASM implementation
          try {
            const { parseStringToArraySyncWASM } = await import(
              "../../../parseStringToArraySyncWASM.ts"
            );
            result = parseStringToArraySyncWASM(data, options);
          } catch (error) {
            // Fall back to regular parser if WASM is not available
            const { parseStringToArraySync } = await import(
              "../../../parseStringToArraySync.ts"
            );
            result = parseStringToArraySync(data, options);
          }
        } else {
          // Use regular synchronous parser
          const { parseStringToArraySync } = await import(
            "../../../parseStringToArraySync.ts"
          );
          result = parseStringToArraySync(data, options);
        }
      } else if (type === "parseStream" && data instanceof ReadableStream) {
        // Stream processing (WASM not supported for streams)
        const { LexerTransformer } = await import("../../../LexerTransformer.ts");
        const { RecordAssemblerTransformer } = await import(
          "../../../RecordAssemblerTransformer.ts"
        );

        result = (data as ReadableStream<string>)
          .pipeThrough(new LexerTransformer(options))
          .pipeThrough(new RecordAssemblerTransformer(options));
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

        // Prevent DecompressionStream usage in Node.js Worker Threads
        // Note: Node.js 20+ has experimental DecompressionStream support, but it may not work
        // reliably in Worker Threads. This check prevents runtime errors with a clear message.
        if (isNodeWorker && decomposition) {
          throw new Error(
            "Decompression is not supported in Node.js Worker Threads. " +
              "Decompress the stream on the main thread before passing to worker, " +
              "or use browser environment with native DecompressionStream support.",
          );
        }

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

        result = textStream
          .pipeThrough(new LexerTransformer(options))
          .pipeThrough(new RecordAssemblerTransformer(options));
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
            result = parseStringToArraySyncWASM(decoded, options);
          } catch (error) {
            // Fall back to regular parser if WASM is not available
            const { parseBinaryToArraySync } = await import(
              "../../../parseBinaryToArraySync.ts"
            );
            result = parseBinaryToArraySync(binary, options);
          }
        } else {
          // Use regular binary parser
          const { parseBinaryToArraySync } = await import(
            "../../../parseBinaryToArraySync.ts"
          );
          result = parseBinaryToArraySync(binary, options);
        }
      } else {
        throw new Error(`Unsupported parse type: ${type}`);
      }

      const response: ParseResponse = { id, result };

      // Transfer stream if applicable (zero-copy)
      if (result instanceof ReadableStream) {
        // @ts-ignore
        workerContext.postMessage(response, { transfer: [result] });
      } else {
        // @ts-ignore
        workerContext.postMessage(response);
      }
    } catch (error) {
      const response: ParseResponse = {
        id,
        error: error instanceof Error ? error.message : String(error),
      };
      // @ts-ignore
      workerContext.postMessage(response);
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
