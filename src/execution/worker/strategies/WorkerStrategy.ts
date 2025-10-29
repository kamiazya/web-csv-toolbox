import type {
  CSVBinary,
  ParseBinaryOptions,
  ParseOptions,
} from "../../../common/types.ts";
import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "../../../constants.ts";
import type { InternalEngineConfig } from "../../InternalEngineConfig.ts";
import type { WorkerSession } from "../helpers/WorkerSession.ts";

/**
 * Worker strategy interface.
 *
 * Defines how data is communicated between main thread and worker thread.
 *
 * @internal
 */
export interface WorkerStrategy<T = any> {
  /**
   * Strategy name.
   */
  readonly name: string;

  /**
   * Execute parsing with this strategy.
   *
   * @param input - Input data (string, binary, or stream)
   * @param options - Parse options
   * @param session - Worker session (can be null for single-use worker)
   * @param engineConfig - Engine configuration
   * @returns Async iterable iterator of parsed records
   */
  execute<
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
  ): AsyncIterableIterator<T>;
}
