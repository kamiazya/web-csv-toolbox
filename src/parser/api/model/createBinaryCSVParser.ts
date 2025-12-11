import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  BinaryArrayCSVParser,
  BinaryCSVParserFactoryOptions,
  BinaryObjectCSVParser,
  ColumnCountStrategy,
} from "@/core/types.ts";
import { WasmIndexerBackend } from "@/parser/indexer/WasmIndexerBackend.ts";
import { FlexibleBinaryArrayCSVParser } from "@/parser/models/FlexibleBinaryArrayCSVParser.ts";
import { FlexibleBinaryObjectCSVParser } from "@/parser/models/FlexibleBinaryObjectCSVParser.ts";
import { WasmBinaryArrayCSVParser } from "@/parser/models/WasmBinaryArrayCSVParser.ts";
import { WasmBinaryObjectCSVParser } from "@/parser/models/WasmBinaryObjectCSVParser.ts";
import { hasWasmSimd } from "@/wasm/loaders/wasmState.ts";
import {
  isInitialized as isWasmInitialized,
  loadWasmSync,
  scanCsvBytesExtendedStreaming,
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
 * - `outputFormat: 'object'` (default) → BinaryObjectCSVParser (FlexibleBinaryObjectCSVParser)
 * - `outputFormat: 'array'` → BinaryArrayCSVParser (FlexibleBinaryArrayCSVParser)
 *
 * **Design Intent**: This factory function accepts options including engine configuration
 * to enable future execution path optimization. The function may select the optimal internal
 * parser implementation based on the provided options. Currently, this optimization
 * is not implemented, but the API is designed to support it without breaking changes.
 *
 * @example Object format (default)
 * ```ts
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'],
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
 *   header: ['name', 'age'],
 *   outputFormat: 'array',
 *   charset: 'utf-8',
 * });
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\nBob,25'))) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
// Overload: When outputFormat is explicitly "array"
export function createBinaryCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Charset extends string = "utf-8",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: BinaryCSVParserFactoryOptions<
    Header,
    Delimiter,
    Quotation,
    Charset,
    "array",
    Strategy
  > & {
    outputFormat: "array";
  },
): BinaryArrayCSVParser<Header>;

// Overload: When outputFormat is explicitly "object"
export function createBinaryCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Charset extends string = "utf-8",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: BinaryCSVParserFactoryOptions<
    Header,
    Delimiter,
    Quotation,
    Charset,
    "object",
    Strategy
  > & {
    outputFormat: "object";
  },
): BinaryObjectCSVParser<Header>;

// Overload: When outputFormat is omitted or undefined (defaults to object)
export function createBinaryCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Charset extends string = "utf-8",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options?: Omit<
    BinaryCSVParserFactoryOptions<
      Header,
      Delimiter,
      Quotation,
      Charset,
      "object",
      Strategy
    >,
    "outputFormat"
  >,
): BinaryObjectCSVParser<Header>;

// Overload: When outputFormat is a union type (dynamic/runtime determined)
export function createBinaryCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Charset extends string = "utf-8",
  const OutputFormat extends "object" | "array" = "object" | "array",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: BinaryCSVParserFactoryOptions<
    Header,
    Delimiter,
    Quotation,
    Charset,
    OutputFormat,
    Strategy
  >,
): BinaryArrayCSVParser<Header> | BinaryObjectCSVParser<Header>;

// Implementation signature
export function createBinaryCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Charset extends string = "utf-8",
  const OutputFormat extends "object" | "array" = "object" | "array",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options?: BinaryCSVParserFactoryOptions<
    Header,
    Delimiter,
    Quotation,
    Charset,
    OutputFormat,
    Strategy
  >,
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

  // Check if WASM engine is requested AND SIMD is available
  const useWasm = options?.engine?.wasm === true;
  if (useWasm && hasWasmSimd()) {
    // Wasm path with SIMD support
    if (!isWasmInitialized()) {
      loadWasmSync();
    }

    const delimiterCode = (options?.delimiter ?? ",").charCodeAt(0);
    const backend = new WasmIndexerBackend(delimiterCode);
    backend.initializeWithModule({
      scanCsvBytesExtendedStreaming,
      scanCsvBytesStreaming,
      scanCsvBytesZeroCopy,
      isInitialized: isWasmInitialized,
      loadWasmSync,
    });

    return format === "array"
      ? (new WasmBinaryArrayCSVParser<Header>(
          (options as any) ?? {},
          backend,
        ) as any)
      : (new WasmBinaryObjectCSVParser<Header>(
          (options as any) ?? {},
          backend,
        ) as any);
  }

  // JavaScript path (also SIMD fallback) - KEEP EXISTING CODE
  // Instantiate the appropriate class based on outputFormat
  // Each class explicitly implements its respective interface
  if (format === "array") {
    return new FlexibleBinaryArrayCSVParser<Header>(
      (options as any) ?? {},
    ) as any;
  } else {
    return new FlexibleBinaryObjectCSVParser<Header>(
      (options as any) ?? {},
    ) as any;
  }
}
