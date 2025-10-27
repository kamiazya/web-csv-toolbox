import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { getNextRequestId, getWorker } from "./helpers/WorkerManager.ts";
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
export async function parseStreamInWorker<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : getNextRequestId();

  // Node.js: Collect stream into string first
  const csvString = await collectStringStream(stream, options?.signal);

  // Send as string data instead of stream
  const records = await sendWorkerMessage<CSVRecord<Header>[]>(
    worker,
    {
      id,
      type: "parseString",
      data: csvString,
      options: serializeOptions(options),
      useWASM: false,
    },
    options,
  );

  // Convert array to async iterator
  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}
