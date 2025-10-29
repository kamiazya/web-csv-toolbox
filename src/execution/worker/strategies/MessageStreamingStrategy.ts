import type {
  ParseOptions,
  ParseBinaryOptions,
  CSVBinary,
} from "../../../common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../../../constants.ts";
import type { InternalEngineConfig } from "../../InternalEngineConfig.ts";
import type { WorkerStrategy } from "./WorkerStrategy.ts";
import { WorkerSession } from "../helpers/WorkerSession.ts";
import { sendWorkerMessage } from "../utils/messageHandler.ts";
import { serializeOptions } from "../utils/serializeOptions.ts";

/**
 * Message-based streaming strategy.
 *
 * Records are sent one-by-one via postMessage.
 * This is the current implementation and works on all browsers including Safari.
 *
 * @internal
 */
export class MessageStreamingStrategy implements WorkerStrategy {
  readonly name = 'message-streaming';

  async *execute<
    T,
    Header extends ReadonlyArray<string> = readonly string[],
    Delimiter extends string = DEFAULT_DELIMITER,
    Quotation extends string = DEFAULT_QUOTATION,
  >(
    input: string | CSVBinary | ReadableStream<string>,
    options:
      | ParseOptions<Header, Delimiter, Quotation>
      | ParseBinaryOptions<Header, Delimiter, Quotation>
      | undefined,
    session: WorkerSession | null,
    engineConfig: InternalEngineConfig,
  ): AsyncIterableIterator<T> {
    // Use provided session or create a new one
    const useProvidedSession = session !== null;
    const workerSession = session ?? await WorkerSession.create({
      workerPool: engineConfig.workerPool,
      workerURL: engineConfig.workerURL,
    });

    try {
      const worker = workerSession.getWorker();
      const id = workerSession.getNextRequestId();

    // Determine message type based on input
    let type: string;
    let data: string | CSVBinary;
    let transfer: Transferable[] | undefined;

    if (typeof input === "string") {
      type = "parseString";
      data = input;
    } else if (input instanceof ReadableStream) {
      // Message-streaming strategy does not support ReadableStream
      // ReadableStream cannot be cloned via postMessage without transferring
      // This should fallback to main thread or use stream-transfer strategy
      throw new Error(
        "Message-streaming strategy does not support ReadableStream. " +
        "Use stream-transfer strategy or process in main thread."
      );
    } else if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
      type = "parseBinary";
      data = input;
      // Transfer binary data for efficiency
      if (input instanceof Uint8Array) {
        transfer = [input.buffer];
      } else {
        transfer = [input];
      }
    } else {
      throw new Error(`Unsupported input type: ${typeof input}`);
    }

      // Send message and yield results
      yield* sendWorkerMessage<T>(
        worker,
        {
          id,
          type,
          data,
          options: serializeOptions(options),
          useWASM: engineConfig.hasWasm(),
        },
        options as ParseOptions<Header> | ParseBinaryOptions<Header> | undefined,
        transfer,
      );
    } finally {
      // Dispose session only if we created it
      if (!useProvidedSession) {
        workerSession[Symbol.dispose]();
      }
    }
  }
}
