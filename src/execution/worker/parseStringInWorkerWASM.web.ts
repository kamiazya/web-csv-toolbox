import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { WorkerSession } from "./helpers/WorkerSession.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";

/**
 * Parse CSV string in Worker thread using WASM (Browser/Deno).
 *
 * @internal
 */
export async function* parseStringInWorkerWASM<
  Header extends ReadonlyArray<string>,
>(
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
      useWASM: true,
    },
    options,
  );
}
