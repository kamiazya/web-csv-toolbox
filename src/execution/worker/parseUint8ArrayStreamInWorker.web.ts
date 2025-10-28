import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";
import { WorkerSession } from "./helpers/WorkerSession.ts";
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
  using session = await WorkerSession.create({
    workerPool: options?.workerPool,
    workerURL: options?.workerURL,
  });

  yield* sendWorkerMessage<CSVRecord<Header>>(
    session.getWorker(),
    {
      id: session.getNextRequestId(),
      type: "parseUint8ArrayStream",
      data: stream,
      options: serializeOptions(options),
    },
    options,
    [stream], // Transfer stream
  );
}
