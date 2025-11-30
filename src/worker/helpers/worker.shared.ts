import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVArrayRecord,
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";

/**
 * Build-time constant injected by Vite for worker bundle variants
 * @internal
 */
declare const __VARIANT__: "main" | "slim";

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
  data: BufferSource;
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
  type: "parseBinaryStream";
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
  result?:
    | (CSVRecord<Header> | CSVArrayRecord<Header>)[]
    | ReadableStream<CSVRecord<Header> | CSVArrayRecord<Header>>;
  error?: string;
}

export interface ParseStreamResponse<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  id: number;
  type: "record" | "done" | "error";
  record?: CSVRecord<Header> | CSVArrayRecord<Header>;
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
    | AsyncIterableIterator<CSVRecord<Header> | CSVArrayRecord<Header>>
    | Iterable<CSVRecord<Header> | CSVArrayRecord<Header>>,
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
    | AsyncIterableIterator<CSVRecord<Header> | CSVArrayRecord<Header>>
    | Iterable<CSVRecord<Header> | CSVArrayRecord<Header>>,
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
    const { id, type, resultPort } = request;

    try {
      // Handle TransferableStream strategy (stream + resultPort)
      if (resultPort) {
        if (type === "parseStringStream") {
          // Type guard: ParseStringStreamRequest
          const req = request as ParseStringStreamRequest;
          // Support both 'stream' and 'data' properties for compatibility
          const stream = req.stream || req.data;
          if (!stream) {
            throw new Error(
              "parseStringStream with resultPort requires 'stream' or 'data' property, but both were undefined. " +
                "Available properties: " +
                Object.keys(req).join(", "),
            );
          }

          const { convertStreamToAsyncIterableIterator } = await import(
            "../../converters/iterators/convertStreamToAsyncIterableIterator.ts"
          );

          // JavaScript path
          const { createStringCSVLexer } = await import(
            "../../parser/api/model/createStringCSVLexer.ts"
          );
          const { createCSVRecordAssembler } = await import(
            "../../parser/api/model/createCSVRecordAssembler.ts"
          );
          const { StringCSVLexerTransformer } = await import(
            "../../parser/stream/StringCSVLexerTransformer.ts"
          );
          const { CSVRecordAssemblerTransformer } = await import(
            "../../parser/stream/CSVRecordAssemblerTransformer.ts"
          );

          const lexer = createStringCSVLexer(req.options);
          const assembler = createCSVRecordAssembler(req.options);

          const resultStream = stream
            .pipeThrough(new StringCSVLexerTransformer(lexer))
            .pipeThrough(new CSVRecordAssemblerTransformer(assembler));

          await streamRecordsToPort(
            resultPort,
            convertStreamToAsyncIterableIterator(resultStream),
          );
          return;
        }

        if (type === "parseBinaryStream") {
          // Type guard: ParseUint8ArrayStreamRequest
          const req = request as ParseUint8ArrayStreamRequest;
          // Support both 'stream' and 'data' properties for compatibility
          const stream = req.stream || req.data;
          if (!stream) {
            throw new Error(
              "parseBinaryStream with resultPort requires 'stream' or 'data' property, but both were undefined. " +
                "Available properties: " +
                Object.keys(req).join(", "),
            );
          }

          const { convertStreamToAsyncIterableIterator } = await import(
            "../../converters/iterators/convertStreamToAsyncIterableIterator.ts"
          );

          const { charset, decompression } = req.options ?? {};

          // JavaScript path
          const { createStringCSVLexer } = await import(
            "../../parser/api/model/createStringCSVLexer.ts"
          );
          const { createCSVRecordAssembler } = await import(
            "../../parser/api/model/createCSVRecordAssembler.ts"
          );
          const { StringCSVLexerTransformer } = await import(
            "../../parser/stream/StringCSVLexerTransformer.ts"
          );
          const { CSVRecordAssemblerTransformer } = await import(
            "../../parser/stream/CSVRecordAssemblerTransformer.ts"
          );

          const { fatal, ignoreBOM } = req.options ?? {};

          const decoderOptions: TextDecoderOptions = {};
          if (fatal !== undefined) decoderOptions.fatal = fatal;
          if (ignoreBOM !== undefined) decoderOptions.ignoreBOM = ignoreBOM;

          // Convert binary stream to text stream then parse
          const textStream = decompression
            ? stream
                .pipeThrough(
                  new DecompressionStream(
                    decompression,
                  ) as unknown as TransformStream<Uint8Array, Uint8Array>,
                )
                .pipeThrough(
                  new TextDecoderStream(
                    charset ?? "utf-8",
                    decoderOptions,
                  ) as unknown as TransformStream<Uint8Array, string>,
                )
            : stream.pipeThrough(
                new TextDecoderStream(
                  charset ?? "utf-8",
                  decoderOptions,
                ) as unknown as TransformStream<Uint8Array, string>,
              );

          const lexer = createStringCSVLexer(req.options);
          const assembler = createCSVRecordAssembler(req.options);

          const resultStream = textStream
            .pipeThrough(new StringCSVLexerTransformer(lexer))
            .pipeThrough(new CSVRecordAssemblerTransformer(assembler));

          await streamRecordsToPort(
            resultPort,
            convertStreamToAsyncIterableIterator(resultStream),
          );
          return;
        }
      }

      // Handle traditional message-based strategies
      if (type === "parseString") {
        // Type guard: ParseStringRequest
        const req = request as ParseStringRequest;
        if (typeof req.data === "string") {
          // Use JavaScript iterator
          const { parseStringToIterableIterator } = await import(
            "../../parser/api/string/parseStringToIterableIterator.ts"
          );
          await streamRecordsToMain(
            workerContext,
            id,
            parseStringToIterableIterator(req.data, req.options),
          );
          return;
        }
      } else if (type === "parseStream") {
        // Type guard: ParseStringStreamRequest
        const req = request as ParseStringStreamRequest;
        if (req.data instanceof ReadableStream) {
          const { convertStreamToAsyncIterableIterator } = await import(
            "../../converters/iterators/convertStreamToAsyncIterableIterator.ts"
          );

          // JavaScript path
          const { createStringCSVLexer } = await import(
            "../../parser/api/model/createStringCSVLexer.ts"
          );
          const { createCSVRecordAssembler } = await import(
            "../../parser/api/model/createCSVRecordAssembler.ts"
          );
          const { StringCSVLexerTransformer } = await import(
            "../../parser/stream/StringCSVLexerTransformer.ts"
          );
          const { CSVRecordAssemblerTransformer } = await import(
            "../../parser/stream/CSVRecordAssemblerTransformer.ts"
          );

          const lexer = createStringCSVLexer(req.options);
          const assembler = createCSVRecordAssembler(req.options);

          const resultStream = req.data
            .pipeThrough(new StringCSVLexerTransformer(lexer))
            .pipeThrough(new CSVRecordAssemblerTransformer(assembler));

          // Convert stream to async iterable and stream records incrementally
          await streamRecordsToMain(
            workerContext,
            id,
            convertStreamToAsyncIterableIterator(resultStream),
          );
          return;
        }
      } else if (type === "parseBinaryStream") {
        // Type guard: ParseUint8ArrayStreamRequest
        const req = request as ParseUint8ArrayStreamRequest;
        if (req.data instanceof ReadableStream) {
          const { convertStreamToAsyncIterableIterator } = await import(
            "../../converters/iterators/convertStreamToAsyncIterableIterator.ts"
          );

          const { charset, decompression } = req.options ?? {};

          // JavaScript path: Binary stream processing
          const { createStringCSVLexer } = await import(
            "../../parser/api/model/createStringCSVLexer.ts"
          );
          const { createCSVRecordAssembler } = await import(
            "../../parser/api/model/createCSVRecordAssembler.ts"
          );
          const { StringCSVLexerTransformer } = await import(
            "../../parser/stream/StringCSVLexerTransformer.ts"
          );
          const { CSVRecordAssemblerTransformer } = await import(
            "../../parser/stream/CSVRecordAssemblerTransformer.ts"
          );

          const { fatal, ignoreBOM } = req.options ?? {};

          const decoderOptions2: TextDecoderOptions = {};
          if (fatal !== undefined) decoderOptions2.fatal = fatal;
          if (ignoreBOM !== undefined) decoderOptions2.ignoreBOM = ignoreBOM;

          // Convert binary stream to text stream then parse
          const textStream = decompression
            ? req.data
                .pipeThrough(
                  new DecompressionStream(
                    decompression,
                  ) as unknown as TransformStream<Uint8Array, Uint8Array>,
                )
                .pipeThrough(
                  new TextDecoderStream(
                    charset ?? "utf-8",
                    decoderOptions2,
                  ) as unknown as TransformStream<Uint8Array, string>,
                )
            : req.data.pipeThrough(
                new TextDecoderStream(
                  charset ?? "utf-8",
                  decoderOptions2,
                ) as unknown as TransformStream<Uint8Array, string>,
              );

          const lexer = createStringCSVLexer(req.options);
          const assembler = createCSVRecordAssembler(req.options);

          const resultStream = textStream
            .pipeThrough(new StringCSVLexerTransformer(lexer))
            .pipeThrough(new CSVRecordAssemblerTransformer(assembler));

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

        // Use JavaScript binary parser with iterator
        const { parseBinaryToIterableIterator } = await import(
          "../../parser/api/binary/parseBinaryToIterableIterator.ts"
        );
        await streamRecordsToMain(
          workerContext,
          id,
          parseBinaryToIterableIterator(req.data, req.options),
        );
        return;
      } else {
        throw new Error(`Unsupported parse type: ${type}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Send error to the appropriate destination
      if (resultPort) {
        // Send error via resultPort for TransferableStream strategy
        resultPort.postMessage({
          type: "error",
          error: errorMessage,
        });
      } else {
        // Send error via workerContext for message-streaming strategy
        const errorResponse: ParseStreamResponse = {
          id,
          type: "error",
          error: errorMessage,
        };
        workerContext.postMessage(errorResponse);
      }
    }
  };
};
