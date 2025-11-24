import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { ParseBinaryOptions, ParseOptions } from "@/core/types.ts";

/**
 * Extract serializable options by removing non-serializable fields.
 *
 * @remarks
 * **Removed fields** (non-serializable):
 * - `signal`: AbortSignal (contains event listeners)
 * - `engine.gpuDeviceManager`: GPUDeviceManager (contains object instances)
 * - `engine.workerPool`: WorkerPool (contains Worker instances)
 * - `engine.workerURL`: Worker-specific, not needed in Worker
 * - `engine.onFallback`: Callback function (cannot be transferred)
 *
 * **Preserved fields** (serializable):
 * - `engine.gpu`: boolean flag
 * - `engine.wasm`: boolean flag
 * - `engine.gpuOptions`: Plain object with serializable GPU configuration
 *
 * @internal
 */
export function serializeOptions<
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  options?:
    | ParseOptions<Header, Delimiter, Quotation>
    | ParseBinaryOptions<Header, Delimiter, Quotation>,
): Omit<typeof options, "signal" | "workerPool" | "workerURL"> | undefined {
  if (!options) return undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    signal: _signal,
    engine,
    workerPool: _workerPool,
    workerURL: _workerURL,
    ...serializableOptions
  } = options as any;

  // Extract serializable engine options
  if (engine) {
    const {
      gpuDeviceManager: _gpuDeviceManager,
      workerPool: _engineWorkerPool,
      workerURL: _engineWorkerURL,
      onFallback: _onFallback,
      worker: _worker,
      workerStrategy: _workerStrategy,
      strict: _strict,
      ...serializableEngine
    } = engine;

    return {
      ...serializableOptions,
      engine: serializableEngine,
    };
  }

  return serializableOptions;
}
