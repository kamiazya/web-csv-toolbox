import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "../../common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../../constants.ts";
import { WorkerSession } from "./helpers/WorkerSession.ts";
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
export async function* parseUint8ArrayStreamInWorker<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Node.js: Collect stream into Uint8Array first
  const combined = await collectUint8ArrayStream(stream, options?.signal);

  using session = await WorkerSession.create({
    workerPool: options?.engine?.workerPool,
    workerURL: options?.engine?.workerURL,
  });

  yield* sendWorkerMessage<CSVRecord<Header>>(
    session.getWorker(),
    {
      id: session.getNextRequestId(),
      type: "parseBinary",
      data: combined,
      options: serializeOptions(options),
      useWASM: false,
    },
    options as ParseOptions<Header> | ParseBinaryOptions<Header> | undefined,
  );
}
