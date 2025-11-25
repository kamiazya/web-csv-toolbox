import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { ParseBinaryOptions, ParseOptions } from "@/core/types.ts";

/**
 * Extract serializable options by removing non-serializable fields.
 *
 * @remarks
 * **Removed fields** (non-serializable or worker-irrelevant):
 * - `signal`: AbortSignal (contains event listeners)
 * - `engine.gpuDeviceManager`: GPUDeviceManager (contains object instances)
 * - `engine.workerPool`: WorkerPool (contains Worker instances)
 * - `engine.workerURL`: Worker-specific, not needed in Worker
 * - `engine.onFallback`: Callback function (cannot be transferred)
 * - `engine.worker`: Worker flag (not needed inside worker)
 * - `engine.gpu`: GPU flag (main thread decision, not needed in worker)
 * - `engine.wasm`: WASM flag (main thread decision, not needed in worker)
 * - `engine.gpuOptions`: GPU options (not needed in worker)
 *
 * **Preserved fields** (serializable and worker-relevant):
 * - `engine.workerStrategy`: Strategy for worker communication
 * - `engine.strict`: Strict mode flag
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
  // Note: gpu, wasm flags are also stripped because workers don't need them
  // (they're for main thread decision-making about execution strategy)
  if (engine) {
    const {
      gpuDeviceManager: _gpuDeviceManager,
      workerPool: _engineWorkerPool,
      workerURL: _engineWorkerURL,
      onFallback: _onFallback,
      worker: _worker,
      gpu: _gpu,
      wasm: _wasm,
      gpuOptions: _gpuOptions,
      // Note: workerStrategy and strict are serializable and should be preserved
      ...serializableEngine
    } = engine;

    // Only include engine if it has serializable properties
    if (Object.keys(serializableEngine).length > 0) {
      return {
        ...serializableOptions,
        engine: serializableEngine,
      };
    }
  }

  return serializableOptions;
}
