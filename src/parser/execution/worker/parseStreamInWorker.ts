import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "../../../core/constants.ts";
import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "../../../core/types.ts";
import { WorkerSession } from "../../../worker/helpers/WorkerSession.ts";
import { sendWorkerMessage } from "../../../worker/utils/messageHandler.ts";
import { serializeOptions } from "../../../worker/utils/serializeOptions.ts";

/**
 * Parse CSV stream in Worker thread.
 * Uses Transferable Streams for zero-copy transfer.
 * Supports both Node.js Worker Threads and Web Workers (Browser/Deno).
 *
 * @internal
 * @param stream CSV string stream to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function* parseStreamInWorker<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header, Delimiter, Quotation>,
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
      type: "parseStream",
      data: stream,
      options: serializeOptions(options),
    },
    options as ParseOptions<Header> | ParseBinaryOptions<Header> | undefined,
    [stream], // Transfer stream
  );
}
