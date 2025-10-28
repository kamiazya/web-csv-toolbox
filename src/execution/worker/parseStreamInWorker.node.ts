import type { CSVRecord, ParseOptions } from "../../common/types.ts";
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
export async function* parseStreamInWorker<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Node.js: Collect stream into string first
  const csvString = await collectStringStream(stream, options?.signal);

  using session = await WorkerSession.create({
    workerPool: options?.workerPool,
    workerURL: options?.workerURL,
  });

  yield* sendWorkerMessage<CSVRecord<Header>>(
    session.getWorker(),
    {
      id: session.getNextRequestId(),
      type: "parseString",
      data: csvString,
      options: serializeOptions(options),
      useWASM: false,
    },
    options,
  );
}
