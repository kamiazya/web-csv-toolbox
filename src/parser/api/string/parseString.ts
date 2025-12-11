import { convertIterableIteratorToAsync } from "@/converters/iterators/convertIterableIteratorToAsync.ts";
import * as internal from "@/converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVRecord,
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { executeWithWorkerStrategy } from "@/engine/strategies/WorkerStrategySelector.ts";
import { parseStringToArraySync } from "@/parser/api/string/parseStringToArraySync.ts";
import { parseStringToIterableIterator } from "@/parser/api/string/parseStringToIterableIterator.ts";
import { parseStringToStream } from "@/parser/api/string/parseStringToStream.ts";
import {
  isWebGPUAvailable,
  parseStringInGPU,
} from "@/parser/execution/gpu/parseStringInGPU.ts";
import { parseStringInWasm } from "@/parser/execution/wasm/parseStringInWasm.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";
import { hasWasmSimd } from "@/wasm/loaders/wasmState.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";

/**
 * Parse CSV string to records.
 *
 * @category Middle-level API
 * @param csv CSV string to parse
 * @param options Parsing options. See {@link ParseOptions}.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseString.toArray} function.
 *
 * @remarks
 * **Performance Characteristics:**
 * - **Memory usage**: O(1) - constant per record (streaming approach)
 * - **Suitable for**: Files of any size
 * - **Recommended for**: Large CSV strings (> 10MB) or memory-constrained environments
 *
 * **Execution Strategies:**
 * Control how parsing is executed using the `engine` option:
 * - **Main thread** (default): `engine: { worker: false }` - No overhead, good for small files
 * - **Worker thread**: `engine: { worker: true }` - Offloads parsing, good for large files
 * - **WebAssembly**: `engine: { wasm: true }` - Fast parsing, limited to UTF-8 and double-quotes
 * - **WebGPU**: `engine: { gpu: true }` - GPU-accelerated (1.44-1.50× faster), optimal for files >100MB
 * - **Combined**: `engine: { worker: true, wasm: true }` - Worker + WASM for maximum performance
 *
 * Use {@link EnginePresets} for convenient configurations:
 * ```ts
 * import { parseString, EnginePresets } from 'web-csv-toolbox';
 *
 * // Use maximum performance execution method
 * for await (const record of parseString(csv, {
 *   engine: EnginePresets.turbo()
 * })) {
 *   console.log(record);
 * }
 * ```
 *
 * @example Parsing CSV files from strings
 *
 * ```ts
 * import { parseString } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * for await (const record of parseString(csv)) {
 *   console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 *
 * @example Using worker execution for better performance
 * ```ts
 * import { parseString } from 'web-csv-toolbox';
 *
 * // Offload parsing to a worker thread
 * for await (const record of parseString(largeCSV, {
 *   engine: { worker: true }
 * })) {
 *   console.log(record);
 * }
 * ```
 *
 * @example Using GPU acceleration for large files (>100MB)
 * ```ts
 * import { parseString } from 'web-csv-toolbox';
 *
 * // GPU-accelerated parsing (1.44-1.50× faster than CPU streaming)
 * for await (const record of parseString(veryLargeCSV, {
 *   engine: { gpu: true }
 * })) {
 *   console.log(record);
 * }
 * // Auto-fallback: GPU → WASM → Pure JS
 * ```
 */
export function parseString<const CSVSource extends string>(
  csv: CSVSource,
): AsyncIterableIterator<CSVRecord<PickCSVHeader<CSVSource>, "object">>;
export function parseString<const Header extends ReadonlyArray<string>>(
  csv: string,
): AsyncIterableIterator<CSVRecord<Header, "object">>;
export function parseString<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  csv: string,
  options: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>>;
export function parseString<
  const CSVSource extends string,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
  const Options extends ParseOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseOptions<Header, Delimiter, Quotation>,
>(
  csv: CSVSource,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>>;
export function parseString(
  csv: string,
  options?: ParseOptions,
): AsyncIterableIterator<CSVRecord<string[]>>;
export async function* parseString<
  Header extends ReadonlyArray<string>,
  Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  csv: string,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>> {
  try {
    // Parse engine configuration
    const engineConfig = new InternalEngineConfig(options?.engine);
    const simdAvailable = hasWasmSimd();

    // GPU execution (highest priority if enabled)
    if (engineConfig.hasGPU()) {
      // Check if WebGPU is available
      const gpuAvailable = await isWebGPUAvailable();

      if (gpuAvailable) {
        try {
          // GPU execution with automatic device management
          yield* parseStringInGPU(csv, options) as AsyncIterableIterator<
            InferCSVRecord<Header, Options>
          >;
          return; // Success, exit function
        } catch (gpuError) {
          // GPU failed, trigger fallback
          if (engineConfig.onFallback) {
            const fallbackConfig = engineConfig.createGPUFallbackConfig();
            engineConfig.onFallback({
              requestedConfig: engineConfig.toConfig(),
              actualConfig: fallbackConfig.toConfig(),
              reason: `GPU initialization failed: ${gpuError instanceof Error ? gpuError.message : String(gpuError)}`,
              error: gpuError instanceof Error ? gpuError : undefined,
            });
          }
          // Fall through to WASM/JS fallback
        }
      } else {
        // WebGPU not available, trigger fallback
        if (engineConfig.onFallback) {
          const fallbackConfig = engineConfig.createGPUFallbackConfig();
          engineConfig.onFallback({
            requestedConfig: engineConfig.toConfig(),
            actualConfig: fallbackConfig.toConfig(),
            reason: "WebGPU is not supported in this environment",
          });
        }
        // Fall through to WASM/JS fallback
      }

      // GPU fallback: try WASM first, then pure JS
      const gpuFallbackConfig = engineConfig.createGPUFallbackConfig();
      const wasmAllowedForGpuFallback =
        simdAvailable &&
        (engineConfig.hasWasm() || gpuFallbackConfig.hasWasm());

      if (engineConfig.hasWasm() || gpuFallbackConfig.hasWasm()) {
        if (!wasmAllowedForGpuFallback) {
          if (engineConfig.onFallback) {
            const fallbackConfig = gpuFallbackConfig.createWasmFallbackConfig();
            engineConfig.onFallback({
              requestedConfig: engineConfig.toConfig(),
              actualConfig: fallbackConfig.toConfig(),
              reason: "WebAssembly SIMD is not supported in this environment",
            });
          }

          const iterator = parseStringToIterableIterator(csv, options);
          yield* convertIterableIteratorToAsync(
            iterator,
          ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
          return;
        }

        if (options?.outputFormat === "array") {
          throw new Error(
            "Array output format is not supported with WASM fallback. " +
              "Use outputFormat: 'object' (default) or disable WASM (engine: { wasm: false }).",
          );
        }
        yield* parseStringInWasm(csv, options) as AsyncIterableIterator<
          InferCSVRecord<Header, Options>
        >;
        return;
      }

      // Final fallback: pure JS
      const iterator = parseStringToIterableIterator(csv, options);
      yield* convertIterableIteratorToAsync(iterator) as AsyncIterableIterator<
        InferCSVRecord<Header, Options>
      >;
      return;
    }

    const wasmEnabled = engineConfig.hasWasm() && simdAvailable;
    const runtimeEngineConfig = wasmEnabled
      ? engineConfig
      : engineConfig.createWasmFallbackConfig();

    if (engineConfig.hasWasm() && !simdAvailable && engineConfig.onFallback) {
      const fallbackConfig = engineConfig.createWasmFallbackConfig();
      engineConfig.onFallback({
        requestedConfig: engineConfig.toConfig(),
        actualConfig: fallbackConfig.toConfig(),
        reason: "WebAssembly SIMD is not supported in this environment",
      });
    }

    if (runtimeEngineConfig.hasWorker()) {
      // Worker execution
      const session = runtimeEngineConfig.workerPool
        ? await WorkerSession.create({
            workerPool: runtimeEngineConfig.workerPool,
            workerURL: runtimeEngineConfig.workerURL,
          })
        : null;

      try {
        yield* executeWithWorkerStrategy<CSVRecord<Header>>(
          csv,
          options,
          session,
          runtimeEngineConfig,
        ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
      } finally {
        session?.[Symbol.dispose]();
      }
    } else {
      // Main thread execution
      if (wasmEnabled) {
        // Validate that array output format is not used with WASM
        if (options?.outputFormat === "array") {
          throw new Error(
            "Array output format is not supported with WASM execution. " +
              "Use outputFormat: 'object' (default) or disable WASM (engine: { wasm: false }).",
          );
        }
        // WASM execution with implicit initialization
        yield* parseStringInWasm(csv, options) as AsyncIterableIterator<
          InferCSVRecord<Header, Options>
        >;
      } else {
        const iterator = parseStringToIterableIterator(csv, options);
        yield* convertIterableIteratorToAsync(
          iterator,
        ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
      }
    }
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
export declare namespace parseString {
  /**
   * Parse CSV string to records.
   *
   * @returns Array of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const records = await parseString.toArray(csv);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export function toArray<
    Header extends ReadonlyArray<string>,
    Options extends ParseOptions<Header> = ParseOptions<Header>,
  >(csv: string, options?: Options): Promise<InferCSVRecord<Header, Options>[]>;
  /**
   * Parse CSV string to records.
   *
   * @returns Array of records
   *
   * @example
   *
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const records = parseString.toArraySync(csv);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export function toArraySync<
    Header extends ReadonlyArray<string>,
    Options extends ParseOptions<Header> = ParseOptions<Header>,
  >(csv: string, options?: Options): InferCSVRecord<Header, Options>[];
  /**
   * Parse CSV string to records.
   *
   * @returns Async iterable iterator of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * for (const record of parseString.toIterableIterator(csv)) {
   *   console.log(record);
   * }
   * // Prints:
   * // { name: 'Alice', age: '42' }
   * // { name: 'Bob', age: '69' }
   * ```
   */
  export function toIterableIterator<
    Header extends ReadonlyArray<string>,
    Options extends ParseOptions<Header> = ParseOptions<Header>,
  >(
    csv: string,
    options?: Options,
  ): IterableIterator<InferCSVRecord<Header, Options>>;
  /**
   * Parse CSV string to records.
   *
   * @returns Readable stream of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * await parseString.toStream(csv)
   *   .pipeTo(
   *      new WritableStream({
   *        write(record) {
   *          console.log(record);
   *        },
   *      }),
   *   );
   * // Prints:
   * // { name: 'Alice', age: '42' }
   * // { name: 'Bob', age: '69' }
   * ```
   */
  export function toStream<
    Header extends ReadonlyArray<string>,
    Options extends ParseOptions<Header> = ParseOptions<Header>,
  >(
    csv: string,
    options?: Options,
  ): ReadableStream<InferCSVRecord<Header, Options>>;
}
Object.defineProperties(parseString, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toArraySync: {
    enumerable: true,
    writable: false,
    value: parseStringToArraySync,
  },
  toIterableIterator: {
    enumerable: true,
    writable: false,
    value: parseStringToIterableIterator,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseStringToStream,
  },
});
