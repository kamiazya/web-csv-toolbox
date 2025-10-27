import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { getNextRequestId, getWorker } from "./helpers/WorkerManager.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";

/**
 * Parse CSV binary in Worker thread (Node.js).
 *
 * @internal
 */
export async function parseBinaryInWorker<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : getNextRequestId();

  const records = await sendWorkerMessage<CSVRecord<Header>[]>(
    worker,
    {
      id,
      type: "parseBinary",
      data: binary,
      options: serializeOptions(options),
      useWASM: false,
    },
    options,
  );

  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}

/**
 * Parse CSV binary in Worker thread using WASM (Node.js).
 *
 * @internal
 */
export async function parseBinaryInWorkerWASM<
  Header extends ReadonlyArray<string>,
>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  const worker = options?.workerPool
    ? await options.workerPool.getWorker(options.workerURL)
    : await getWorker(options?.workerURL);
  const id = options?.workerPool
    ? options.workerPool.getNextRequestId()
    : getNextRequestId();

  const records = await sendWorkerMessage<CSVRecord<Header>[]>(
    worker,
    {
      id,
      type: "parseBinary",
      data: binary,
      options: serializeOptions(options),
      useWASM: true,
    },
    options,
  );

  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}
