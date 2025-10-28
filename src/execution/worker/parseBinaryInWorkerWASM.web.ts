import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { WorkerSession } from "./helpers/WorkerSession.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";

/**
 * Parse CSV binary in Worker thread using WASM (Browser/Deno).
 *
 * @internal
 */
export async function* parseBinaryInWorkerWASM<
  Header extends ReadonlyArray<string>,
>(
  binary: Uint8Array | ArrayBuffer,
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
      type: "parseBinary",
      data: binary,
      options: serializeOptions(options),
      useWASM: true,
    },
    options,
  );
}
