import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { getNextRequestId, getWorker } from "./helpers/WorkerManager.ts";
import { sendWorkerMessage } from "./utils/messageHandler.ts";
import { serializeOptions } from "./utils/serializeOptions.ts";

/**
 * Parse CSV string in Worker thread (Node.js).
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
  // Use WorkerPool if provided, otherwise use module-level singleton
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
      type: "parseString",
      data: csv,
      options: serializeOptions(options),
      useWASM: false,
    },
    options,
  );

  // Yield each record directly
  for (const record of records) {
    yield record;
  }
}

/**
 * Parse CSV string in Worker thread using WASM (Node.js).
 *
 * @internal
 */
export async function* parseStringInWorkerWASM<
  Header extends ReadonlyArray<string>,
>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
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
      type: "parseString",
      data: csv,
      options: serializeOptions(options),
      useWASM: true,
    },
    options,
  );

  for (const record of records) {
    yield record;
  }
}
