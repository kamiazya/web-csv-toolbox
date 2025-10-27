import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { getNextRequestId, getWorker } from "./helpers/WorkerManager.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";
import { collectUint8ArrayStream } from "./utils/streamCollector.node.ts";

/**
 * Parse CSV Uint8Array stream in Worker thread (Node.js).
 * Collects stream into Uint8Array first, then sends to worker.
 *
 * Note: Node.js Worker Threads do not support ReadableStream transfer,
 * so we collect the stream into an array first.
 *
 * @internal
 */
export async function parseUint8ArrayStreamInWorker<
  Header extends ReadonlyArray<string>,
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : getNextRequestId();

  // Node.js: Collect stream into Uint8Array first
  const combined = await collectUint8ArrayStream(stream, options?.signal);

  // Send as binary data instead of stream
  const records = await sendWorkerMessage<CSVRecord<Header>[]>(
    worker,
    {
      id,
      type: "parseBinary",
      data: combined,
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
