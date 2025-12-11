import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";
import { sendWorkerMessage } from "@/worker/utils/messageHandler.ts";
import { serializeOptions } from "@/worker/utils/serializeOptions.ts";

/**
 * Parse CSV Uint8Array stream in Worker thread using Wasm.
 * Uses Transferable Streams for zero-copy transfer.
 * Uses WasmBinaryCSVStreamTransformer for direct binary processing (no TextDecoder overhead).
 *
 * This provides non-blocking CSV parsing for large files while maintaining UI responsiveness.
 *
 * Supports both Node.js (>=20.0.0) and Browser/Deno environments.
 * Node.js 20+ supports ReadableStream transfer across worker threads.
 *
 * @internal
 * @param stream CSV Uint8Array stream to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function* parseBinaryStreamInWorkerWasm<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  using session = await WorkerSession.create(
    options?.engine?.worker === true
      ? {
          workerURL: options.engine.workerURL,
          workerPool: options.engine.workerPool,
        }
      : undefined,
  );

  yield* sendWorkerMessage<CSVRecord<Header>>(
    session.getWorker(),
    {
      id: session.getNextRequestId(),
      type: "parseBinaryStream",
      data: stream,
      options: serializeOptions(options),
      useWASM: true, // Enable Wasm binary processing
    },
    options as ParseOptions<Header> | ParseBinaryOptions<Header> | undefined,
    [stream], // Transfer stream
  );
}
