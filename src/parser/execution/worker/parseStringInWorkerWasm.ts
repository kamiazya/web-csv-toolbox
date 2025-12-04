import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";
import { sendWorkerMessage } from "@/worker/utils/messageHandler.ts";
import { serializeOptions } from "@/worker/utils/serializeOptions.ts";

/**
 * Parse CSV string in Worker thread using Wasm.
 * Supports both Node.js Worker Threads and Web Workers (Browser/Deno).
 *
 * @internal
 */
export async function* parseStringInWorkerWasm<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  csv: string,
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
      type: "parseString",
      data: csv,
      options: serializeOptions(options),
      useWasm: true,
    },
    options as ParseOptions<Header> | ParseBinaryOptions<Header> | undefined,
  );
}
