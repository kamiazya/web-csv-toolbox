import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";
import { getNextRequestId, getWorker } from "./helpers/WorkerManager.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";

/**
 * Parse CSV stream in Worker thread (Browser/Deno).
 * Uses Transferable Streams for zero-copy transfer.
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
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : getNextRequestId();

  // Browser: Use Transferable Streams (zero-copy)
  const recordStream = await sendWorkerMessage<
    ReadableStream<CSVRecord<Header>>
  >(
    worker,
    {
      id,
      type: "parseStream",
      data: stream,
      options: serializeOptions(options),
    },
    options,
    [stream], // Transfer stream
  );

  yield* convertStreamToAsyncIterableIterator(recordStream);
}
