import type {
  BinaryArrayCSVParser,
  BinaryCSVParserFactoryOptions,
  BinaryObjectCSVParser,
  FactoryEngineOptions,
} from "@/core/types.ts";
import { WASMIndexerBackend } from "@/parser/indexer/WASMIndexerBackend.ts";
import { FlexibleBinaryArrayCSVParser } from "@/parser/models/FlexibleBinaryArrayCSVParser.ts";
import { FlexibleBinaryObjectCSVParser } from "@/parser/models/FlexibleBinaryObjectCSVParser.ts";
import { WASMBinaryArrayCSVParser } from "@/parser/models/WASMBinaryArrayCSVParser.ts";
import { WASMBinaryObjectCSVParser } from "@/parser/models/WASMBinaryObjectCSVParser.ts";
import {
  isInitialized as isWASMInitialized,
  loadWASMSync,
  scanCsvBytesStreaming,
  scanCsvBytesZeroCopy,
} from "@/wasm/WasmInstance.main.web.ts";

/**
 * Factory function to create the appropriate Binary CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @param options - Parser options including binary CSV processing specification and engine
 * @returns A parser instance configured for the specified output format
 *
 * @remarks
 * This function provides both compile-time and runtime type safety.
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → BinaryObjectCSVParser
 * - `outputFormat: 'array'` → BinaryArrayCSVParser
 *
 * **Design Intent**: This factory function accepts options including engine configuration
 * to enable future execution path optimization. The function may select the optimal internal
 * parser implementation based on the provided options. Currently, this optimization
 * is not implemented, but the API is designed to support it without breaking changes.
 *
 * @example Object format (default)
 * ```ts
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'] as const,
 *   charset: 'utf-8',
 *   decompression: 'gzip',
 *   signal: abortController.signal,
 * });
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\nBob,25'))) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example Array format
 * ```ts
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'array',
 *   charset: 'utf-8',
 * });
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\nBob,25'))) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<BinaryCSVParserFactoryOptions<Header>, "outputFormat"> & {
    outputFormat: "array";
  },
): BinaryArrayCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<BinaryCSVParserFactoryOptions<Header>, "outputFormat"> & {
    outputFormat: "object";
  },
): BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<BinaryCSVParserFactoryOptions<Header>, "outputFormat"> & {
    outputFormat: "object" | "array";
  },
): BinaryArrayCSVParser<Header> | BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: BinaryCSVParserFactoryOptions<Header>,
): BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: BinaryCSVParserFactoryOptions<Header>,
): BinaryArrayCSVParser<Header> | BinaryObjectCSVParser<Header> {
  const format = options?.outputFormat ?? "object";

  // Validate that includeHeader is only used with array format
  if (
    options &&
    "includeHeader" in options &&
    options.includeHeader &&
    format !== "array"
  ) {
    throw new Error("includeHeader option is only valid for array format");
  }

  // Check if WASM engine is requested
  const useWASM = options?.engine?.wasm === true;

  if (useWASM) {
    // WASM implementation
    // Ensure WASM is initialized
    if (!isWASMInitialized()) {
      loadWASMSync();
    }

    // Get delimiter character code
    const delimiterCode = (options?.delimiter ?? ",").charCodeAt(0);

    // Create and initialize WASM backend
    const backend = new WASMIndexerBackend(delimiterCode);
    backend.initializeWithModule({
      scanCsvBytesStreaming,
      scanCsvBytesZeroCopy,
      isInitialized: isWASMInitialized,
      loadWASMSync,
    });

    if (format === "array") {
      return new WASMBinaryArrayCSVParser<Header>(
        options ?? {},
        backend,
      ) as any;
    } else {
      return new WASMBinaryObjectCSVParser<Header>(
        options ?? {},
        backend,
      ) as any;
    }
  }

  // JavaScript implementation
  if (format === "array") {
    return new FlexibleBinaryArrayCSVParser<Header>(options ?? {}) as any;
  } else {
    return new FlexibleBinaryObjectCSVParser<Header>(options ?? {}) as any;
  }
}
