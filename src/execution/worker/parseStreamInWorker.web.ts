import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";
import { WorkerSession } from "./helpers/WorkerSession.ts";
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
  using session = await WorkerSession.create({
    workerPool: options?.workerPool,
    workerURL: options?.workerURL,
  });

  yield* sendWorkerMessage<CSVRecord<Header>>(
    session.getWorker(),
    {
      id: session.getNextRequestId(),
      type: "parseStream",
      data: stream,
      options: serializeOptions(options),
    },
    options,
    [stream], // Transfer stream
  );
}
