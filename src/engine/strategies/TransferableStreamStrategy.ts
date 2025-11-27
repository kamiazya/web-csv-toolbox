import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVBinary,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import type { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import type { WorkerStrategy } from "@/engine/strategies/WorkerStrategy.ts";
import type { WorkerSession } from "@/worker/helpers/WorkerSession.ts";
import { serializeOptions } from "@/worker/utils/serializeOptions.ts";
import { receiveResults } from "./helpers/MessagePortReceiver.ts";
import { inspectAndReconstructStream } from "./helpers/StreamInspector.ts";
import { WorkerSessionScope } from "./helpers/WorkerSessionScope.ts";

/**
 * TransferableStream-based strategy.
 *
 * Streams are transferred directly to the worker using zero-copy transfer.
 * This is more efficient than message-streaming but only supported in
 * Chrome, Firefox, and Edge (not Safari).
 *
 * @internal
 */
export class TransferableStreamStrategy implements WorkerStrategy {
  readonly name = "stream-transfer";

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
    // Ensure input is a ReadableStream
    if (!(input instanceof ReadableStream)) {
      throw new Error(
        `TransferableStreamStrategy requires ReadableStream input, got ${typeof input}`,
      );
    }

    // Check abort status before processing
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    // Create session scope (handles ownership semantics)
    // TODO: When Node.js 24 becomes the minimum supported version, use:
    // using scope = await WorkerSessionScope.create(session, engineConfig);
    const scope = await WorkerSessionScope.create(session, engineConfig);
    try {
      // Inspect stream to determine type and reconstruct with first chunk
      const inspection = await inspectAndReconstructStream(
        input as ReadableStream<string | Uint8Array>,
      );
      if (!inspection) {
        // Empty stream
        return;
      }

      // Create message channel for receiving results
      const channel = new MessageChannel();
      const resultPort = channel.port1;
      const workerPort = channel.port2;

      // Send the stream and worker port to the worker
      scope.getWorker().postMessage(
        {
          id: scope.getNextRequestId(),
          type: inspection.type,
          stream: inspection.stream,
          options: serializeOptions(options),
          useWASM: engineConfig.hasWasm(),
          useGPU: engineConfig.hasGpu(),
          resultPort: workerPort,
        },
        [inspection.stream as unknown as Transferable, workerPort],
      );

      // Yield results from the worker
      yield* receiveResults<T>(resultPort, options?.signal);
    } finally {
      scope.dispose();
    }
  }
}
