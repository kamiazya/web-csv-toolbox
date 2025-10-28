import type { ParseOptions, ParseBinaryOptions } from "../../../common/types.ts";
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
  execute(
    input: any,
    options: ParseOptions<any> | ParseBinaryOptions<any> | undefined,
    session: WorkerSession | null,
    engineConfig: InternalEngineConfig,
  ): AsyncIterableIterator<T>;
}
