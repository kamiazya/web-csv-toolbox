import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "../../../common/types.ts";
import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "../../../constants.ts";

/**
 * Base interface for Worker requests
 * @internal
 */
interface BaseParseRequest {
  id: number;
  useWASM?: boolean;
  resultPort?: MessagePort;
}

/**
 * Parse string request
 * @internal
 */
export interface ParseStringRequest<
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends BaseParseRequest {
  type: "parseString";
  data: string;
  options?: ParseOptions<Header, Delimiter, Quotation>;
}

/**
 * Parse binary request
 * @internal
 */
export interface ParseBinaryRequest<
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends BaseParseRequest {
  type: "parseBinary";
  data: Uint8Array | ArrayBuffer;
  options?: ParseBinaryOptions<Header, Delimiter, Quotation>;
}

/**
 * Parse string stream request
 * @internal
 */
export interface ParseStringStreamRequest<
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends BaseParseRequest {
  type: "parseStream" | "parseStringStream";
  data?: ReadableStream<string>;
  stream?: ReadableStream<string>;
  options?: ParseOptions<Header, Delimiter, Quotation>;
}

/**
 * Parse binary stream request
 * @internal
 */
export interface ParseUint8ArrayStreamRequest<
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends BaseParseRequest {
  type: "parseUint8ArrayStream";
  data?: ReadableStream<Uint8Array>;
  stream?: ReadableStream<Uint8Array>;
  options?: ParseBinaryOptions<Header, Delimiter, Quotation>;
}

/**
 * Message types for Worker communication.
 * @internal
 */
export type ParseRequest<
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> =
  | ParseStringRequest<Header, Delimiter, Quotation>
  | ParseBinaryRequest<Header, Delimiter, Quotation>
  | ParseStringStreamRequest<Header, Delimiter, Quotation>
  | ParseUint8ArrayStreamRequest<Header, Delimiter, Quotation>;

export interface ParseResponse<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  id: number;
  result?: CSVRecord<Header>[] | ReadableStream<CSVRecord<Header>>;
  error?: string;
}

export interface ParseStreamResponse<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  id: number;
  type: "record" | "done" | "error";
  record?: CSVRecord<Header>;
  error?: string;
}

/**
 * Worker context interface (unified for Web Workers and Worker Threads)
 * @internal
 */
export interface WorkerContext<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  postMessage(message: ParseStreamResponse<Header>): void;
}

/**
 * Helper to stream records incrementally to avoid memory issues.
 * @internal
 */
export const streamRecordsToMain = async <
  Header extends ReadonlyArray<string> = readonly string[],
>(
  workerContext: WorkerContext<Header>,
  id: number,
  records:
    | AsyncIterableIterator<CSVRecord<Header>>
    | Iterable<CSVRecord<Header>>,
): Promise<void> => {
  try {
    for await (const record of records) {
      const response: ParseStreamResponse<Header> = {
        id,
        type: "record",
        record,
      };
      workerContext.postMessage(response);
    }
    // Send done signal
    const doneResponse: ParseStreamResponse<Header> = { id, type: "done" };
    workerContext.postMessage(doneResponse);
  } catch (error) {
    const errorResponse: ParseStreamResponse<Header> = {
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
export const streamRecordsToPort = async <
  Header extends ReadonlyArray<string> = readonly string[],
>(
  port: MessagePort,
  records:
    | AsyncIterableIterator<CSVRecord<Header>>
    | Iterable<CSVRecord<Header>>,
): Promise<void> => {
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
export const createMessageHandler = (workerContext: WorkerContext) => {
  return async (request: ParseRequest) => {
    const { id, type, useWASM, resultPort } = request;

    try {
      // Handle TransferableStream strategy (stream + resultPort)
      if (resultPort) {
        if (type === "parseStringStream") {
          // Type guard: ParseStringStreamRequest
          const req = request as ParseStringStreamRequest;
          if (req.stream) {
            // Process string stream with TransferableStream strategy
            const { CSVLexerTransformer } = await import(
              "../../../CSVLexerTransformer.ts"
            );
            const { CSVRecordAssemblerTransformer } = await import(
              "../../../CSVRecordAssemblerTransformer.ts"
            );
            const { convertStreamToAsyncIterableIterator } = await import(
              "../../../utils/convertStreamToAsyncIterableIterator.ts"
            );

            const resultStream = req.stream
              .pipeThrough(new CSVLexerTransformer(req.options))
              .pipeThrough(new CSVRecordAssemblerTransformer(req.options));

            await streamRecordsToPort(
              resultPort,
              convertStreamToAsyncIterableIterator(resultStream),
            );
            return;
          }
        }

        if (type === "parseUint8ArrayStream") {
          // Type guard: ParseUint8ArrayStreamRequest
          const req = request as ParseUint8ArrayStreamRequest;
          if (req.stream) {
            // Process binary stream with TransferableStream strategy
            const { CSVLexerTransformer } = await import(
              "../../../CSVLexerTransformer.ts"
            );
            const { CSVRecordAssemblerTransformer } = await import(
              "../../../CSVRecordAssemblerTransformer.ts"
            );

            const { charset, fatal, ignoreBOM, decompression } =
              req.options ?? {};

            // Convert binary stream to text stream then parse
            const textStream = decompression
              ? req.stream
                  .pipeThrough(
                    new DecompressionStream(
                      decompression,
                    ) as unknown as TransformStream<Uint8Array, Uint8Array>,
                  )
                  .pipeThrough(
                    new TextDecoderStream(charset ?? "utf-8", {
                      fatal,
                      ignoreBOM,
                    }) as unknown as TransformStream<Uint8Array, string>,
                  )
              : req.stream.pipeThrough(
                  new TextDecoderStream(charset ?? "utf-8", {
                    fatal,
                    ignoreBOM,
                  }) as unknown as TransformStream<Uint8Array, string>,
                );

            const { convertStreamToAsyncIterableIterator } = await import(
              "../../../utils/convertStreamToAsyncIterableIterator.ts"
            );

            const resultStream = textStream
              .pipeThrough(new CSVLexerTransformer(req.options))
              .pipeThrough(new CSVRecordAssemblerTransformer(req.options));

            await streamRecordsToPort(
              resultPort,
              convertStreamToAsyncIterableIterator(resultStream),
            );
            return;
          }
        }
      }

      // Handle traditional message-based strategies
      if (type === "parseString") {
        // Type guard: ParseStringRequest
        const req = request as ParseStringRequest;
        if (typeof req.data === "string") {
          if (useWASM) {
            // Dynamic import WASM implementation
            try {
              const { parseStringToArraySyncWASM } = await import(
                "../../../parseStringToArraySyncWASM.ts"
              );
              await streamRecordsToMain(
                workerContext,
                id,
                parseStringToArraySyncWASM(req.data, req.options),
              );
              return;
            } catch (_error) {
              // Fall back to regular parser if WASM is not available
              const { parseStringToIterableIterator } = await import(
                "../../../parseStringToIterableIterator.ts"
              );
              await streamRecordsToMain(
                workerContext,
                id,
                parseStringToIterableIterator(req.data, req.options),
              );
              return;
            }
          } else {
            // Use regular parser with iterator
            const { parseStringToIterableIterator } = await import(
              "../../../parseStringToIterableIterator.ts"
            );
            await streamRecordsToMain(
              workerContext,
              id,
              parseStringToIterableIterator(req.data, req.options),
            );
            return;
          }
        }
      } else if (type === "parseStream") {
        // Type guard: ParseStringStreamRequest
        const req = request as ParseStringStreamRequest;
        if (req.data instanceof ReadableStream) {
          // Stream processing (WASM not supported for streams)
          const { CSVLexerTransformer } = await import(
            "../../../CSVLexerTransformer.ts"
          );
          const { CSVRecordAssemblerTransformer } = await import(
            "../../../CSVRecordAssemblerTransformer.ts"
          );
          const { convertStreamToAsyncIterableIterator } = await import(
            "../../../utils/convertStreamToAsyncIterableIterator.ts"
          );

          const resultStream = req.data
            .pipeThrough(new CSVLexerTransformer(req.options))
            .pipeThrough(new CSVRecordAssemblerTransformer(req.options));

          // Convert stream to async iterable and stream records incrementally
          await streamRecordsToMain(
            workerContext,
            id,
            convertStreamToAsyncIterableIterator(resultStream),
          );
          return;
        }
      } else if (type === "parseUint8ArrayStream") {
        // Type guard: ParseUint8ArrayStreamRequest
        const req = request as ParseUint8ArrayStreamRequest;
        if (req.data instanceof ReadableStream) {
          // Binary stream processing
          const { CSVLexerTransformer } = await import(
            "../../../CSVLexerTransformer.ts"
          );
          const { CSVRecordAssemblerTransformer } = await import(
            "../../../CSVRecordAssemblerTransformer.ts"
          );

          const { charset, fatal, ignoreBOM, decompression } =
            req.options ?? {};

          // Convert binary stream to text stream then parse
          const textStream = decompression
            ? req.data
                .pipeThrough(
                  new DecompressionStream(
                    decompression,
                  ) as unknown as TransformStream<Uint8Array, Uint8Array>,
                )
                .pipeThrough(
                  new TextDecoderStream(charset ?? "utf-8", {
                    fatal,
                    ignoreBOM,
                  }) as unknown as TransformStream<Uint8Array, string>,
                )
            : req.data.pipeThrough(
                new TextDecoderStream(charset ?? "utf-8", {
                  fatal,
                  ignoreBOM,
                }) as unknown as TransformStream<Uint8Array, string>,
              );

          const { convertStreamToAsyncIterableIterator } = await import(
            "../../../utils/convertStreamToAsyncIterableIterator.ts"
          );

          const resultStream = textStream
            .pipeThrough(new CSVLexerTransformer(req.options))
            .pipeThrough(new CSVRecordAssemblerTransformer(req.options));

          // Convert stream to async iterable and stream records incrementally
          await streamRecordsToMain(
            workerContext,
            id,
            convertStreamToAsyncIterableIterator(resultStream),
          );
          return;
        }
      } else if (type === "parseBinary") {
        // Type guard: ParseBinaryRequest
        const req = request as ParseBinaryRequest;

        if (useWASM) {
          // Convert (and optionally decompress) then use WASM
          try {
            const {
              charset = "utf-8",
              fatal,
              ignoreBOM,
              decompression,
            } = req.options ?? {};
            const asBytes =
              req.data instanceof Uint8Array
                ? req.data
                : new Uint8Array(req.data);
            let decoded: string;
            if (decompression) {
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
                    decompression,
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
            await streamRecordsToMain(
              workerContext,
              id,
              parseStringToArraySyncWASM(decoded, req.options),
            );
            return;
          } catch (_error) {
            // Fall back to regular parser if WASM is not available
            const { parseBinaryToIterableIterator } = await import(
              "../../../parseBinaryToIterableIterator.ts"
            );
            await streamRecordsToMain(
              workerContext,
              id,
              parseBinaryToIterableIterator(req.data, req.options),
            );
            return;
          }
        } else {
          // Use regular binary parser with iterator
          const { parseBinaryToIterableIterator } = await import(
            "../../../parseBinaryToIterableIterator.ts"
          );
          await streamRecordsToMain(
            workerContext,
            id,
            parseBinaryToIterableIterator(req.data, req.options),
          );
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
      workerContext.postMessage(errorResponse);
    }
  };
};
