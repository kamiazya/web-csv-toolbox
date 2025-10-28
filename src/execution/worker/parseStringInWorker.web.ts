import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { WorkerSession } from "./helpers/WorkerSession.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";

/**
 * Parse CSV string in Worker thread (Browser/Deno).
 *
 * @internal
 * @param csv CSV string to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export async function* parseStringInWorker<Header extends ReadonlyArray<string>>(
  csv: string,
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
      type: "parseString",
      data: csv,
      options: serializeOptions(options),
      useWASM: false,
    },
    options,
  );
}
