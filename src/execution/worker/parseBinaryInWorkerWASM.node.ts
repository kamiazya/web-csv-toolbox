import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "../../common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../../constants.ts";
import { WorkerSession } from "./helpers/WorkerSession.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";

/**
 * Parse CSV binary in Worker thread using WASM (Node.js).
 *
 * @internal
 */
export async function* parseBinaryInWorkerWASM<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  using session = await WorkerSession.create({
    workerPool: options?.engine?.workerPool,
    workerURL: options?.engine?.workerURL,
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
    options as ParseOptions<Header> | ParseBinaryOptions<Header> | undefined,
  );
}
