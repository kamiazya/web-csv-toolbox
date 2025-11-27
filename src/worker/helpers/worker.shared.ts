import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";

/**
 * Base interface for Worker requests
 * @internal
 */
interface BaseParseRequest {
  id: number;
  useWASM?: boolean;
  useGPU?: boolean;
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
 * @deprecated Use streamRecords from outputStrategy.ts instead
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
 * @deprecated Use streamRecords from outputStrategy.ts instead
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
 * Handles different parsing strategies (regular, WASM, GPU, streaming).
 *
 * @internal
 */
export const createMessageHandler = (workerContext: WorkerContext) => {
  return async (request: ParseRequest) => {
    const { id, type, resultPort } = request;

    // Import output strategies
    const { MainThreadStrategy, MessagePortStrategy } = await import(
      "@/worker/utils/outputStrategy.ts"
    );

    // Import handlers directly
    const { parseStringHandler } = await import(
      "@/worker/handlers/parseStringHandler.ts"
    );
    const { parseStreamHandler } = await import(
      "@/worker/handlers/parseStreamHandler.ts"
    );
    const { parseBinaryHandler } = await import(
      "@/worker/handlers/parseBinaryHandler.ts"
    );
    const { parseBinaryStreamHandler } = await import(
      "@/worker/handlers/parseBinaryStreamHandler.ts"
    );
    const { parseStringStreamHandler } = await import(
      "@/worker/handlers/parseStringStreamHandler.ts"
    );

    type AnyHandler = (
      request: ParseRequest,
      context: {
        workerContext: WorkerContext;
        outputStrategy:
          | InstanceType<typeof MainThreadStrategy>
          | InstanceType<typeof MessagePortStrategy>;
      },
    ) => Promise<void>;

    // Select handler based on request type
    const handlers: Record<string, AnyHandler> = {
      parseString: parseStringHandler as AnyHandler,
      parseStream: parseStreamHandler as AnyHandler,
      parseBinary: parseBinaryHandler as AnyHandler,
      parseBinaryStream: parseBinaryStreamHandler as AnyHandler,
      parseStringStream: parseStringStreamHandler as AnyHandler,
    };
    const handler = handlers[type];
    if (!handler) {
      const errorMessage = `Unsupported parse type: ${type}`;
      if (resultPort) {
        resultPort.postMessage({ type: "error", error: errorMessage });
      } else {
        workerContext.postMessage({ id, type: "error", error: errorMessage });
      }
      return;
    }

    // Select output strategy based on presence of resultPort
    const outputStrategy = resultPort
      ? new MessagePortStrategy(resultPort)
      : new MainThreadStrategy(workerContext, id);

    try {
      await handler(request, { workerContext, outputStrategy });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      outputStrategy.sendError(errorMessage);
    }
  };
};
