import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";
import { getNextRequestId, getWorker } from "./helpers/WorkerManager.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";

/**
 * Parse CSV Uint8Array stream in Worker thread (Browser/Deno).
 * Uses Transferable Streams for zero-copy transfer.
 *
 * @internal
 */
export async function* parseUint8ArrayStreamInWorker<
  Header extends ReadonlyArray<string>,
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
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
      type: "parseUint8ArrayStream",
      data: stream,
      options: serializeOptions(options),
    },
    options,
    [stream], // Transfer stream
  );

  yield* convertStreamToAsyncIterableIterator(recordStream);
}
