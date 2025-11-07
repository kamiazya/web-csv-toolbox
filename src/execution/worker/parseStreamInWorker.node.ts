import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "../../common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../../constants.ts";
import { WorkerSession } from "./helpers/WorkerSession.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";
import { collectStringStream } from "./utils/streamCollector.node.ts";

/**
 * Parse CSV stream in Worker thread (Node.js).
 * Collects stream into string first, then sends to worker.
 *
 * Note: Node.js Worker Threads do not support ReadableStream transfer,
 * so we collect the stream into a string first.
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
  // Node.js: Collect stream into string first
  const csvString = await collectStringStream(stream, options?.signal);

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
      type: "parseString",
      data: csvString,
      options: serializeOptions(options),
      useWASM: false,
    },
    options as ParseOptions<Header> | ParseBinaryOptions<Header> | undefined,
  );
}
