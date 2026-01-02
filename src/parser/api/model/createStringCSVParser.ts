import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  ColumnCountStrategy,
  StringArrayCSVParser,
  StringCSVParserFactoryOptions,
  StringObjectCSVParser,
} from "@/core/types.ts";
import { WasmIndexerBackend } from "@/parser/indexer/WasmIndexerBackend.ts";
import { FlexibleStringArrayCSVParser } from "@/parser/models/FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "@/parser/models/FlexibleStringObjectCSVParser.ts";
import { WasmStringUtf8ArrayCSVParser } from "@/parser/models/WasmStringUtf8ArrayCSVParser.ts";
import { WasmStringUtf8ObjectCSVParser } from "@/parser/models/WasmStringUtf8ObjectCSVParser.ts";
import { WasmStringUtf16ArrayCSVParser } from "@/parser/models/WasmStringUtf16ArrayCSVParser.ts";
import { WasmStringUtf16ObjectCSVParser } from "@/parser/models/WasmStringUtf16ObjectCSVParser.ts";
import { hasWasmSimd } from "@/wasm/loaders/wasmState.ts";
import {
  isInitialized as isWasmInitialized,
  loadWasmSync,
  scanCsvBytesStreaming,
  scanCsvBytesZeroCopy,
} from "@/wasm/WasmInstance.main.web.ts";

/**
 * Determines whether UTF-16 encoding should be preferred for string parsing.
 *
 * @param options - Parser options
 * @returns true if UTF-16 encoding should be used, false otherwise
 *
 * @remarks
 * Currently, StringCSVParserFactoryOptions does not include a charset field.
 * This function is designed for future extensibility when charset support
 * may be added to string parsers. For now, it always returns false (UTF-8).
 *
 * When charset support is added, this function should check:
 * - options.charset for values like "utf-16", "utf-16le", "utf-16be"
 * - or any engine-specific UTF-16 preference flags
 */
function prefersUtf16(
  _options?: StringCSVParserFactoryOptions<any, any, any, any, any>,
): boolean {
  // Future: Check options.charset when it's added to StringCSVParserFactoryOptions
  // const charset = options?.charset ?? "utf-8";
  // return charset.toLowerCase().includes("utf-16") ||
  //        charset.toLowerCase().includes("utf16");
  return false;
}

/**
 * Factory function to create the appropriate String CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @param options - Parser options including CSV processing specification and engine
 * @returns A parser instance configured for the specified output format
 *
 * @remarks
 * This function provides both compile-time and runtime type safety.
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → StringObjectCSVParser (FlexibleStringObjectCSVParser)
 * - `outputFormat: 'array'` → StringArrayCSVParser (FlexibleStringArrayCSVParser)
 *
 * **Design Intent**: This factory function accepts options including engine configuration
 * to enable future execution path optimization. The function may select the optimal internal
 * parser implementation based on the provided options. Currently, this optimization
 * is not implemented, but the API is designed to support it without breaking changes.
 *
 * @example Object format (default)
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'],
 *   delimiter: ',',
 *   signal: abortController.signal,
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example Array format
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'],
 *   outputFormat: 'array',
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
// Overload: When outputFormat is explicitly "array"
export function createStringCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: StringCSVParserFactoryOptions<
    Header,
    Delimiter,
    Quotation,
    "array",
    Strategy
  > & {
    outputFormat: "array";
  },
): StringArrayCSVParser<Header>;

// Overload: When outputFormat is explicitly "object"
export function createStringCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: StringCSVParserFactoryOptions<
    Header,
    Delimiter,
    Quotation,
    "object",
    Strategy
  > & {
    outputFormat: "object";
  },
): StringObjectCSVParser<Header>;

// Overload: When outputFormat is omitted or undefined (defaults to object)
export function createStringCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options?: Omit<
    StringCSVParserFactoryOptions<
      Header,
      Delimiter,
      Quotation,
      "object",
      Strategy
    >,
    "outputFormat"
  >,
): StringObjectCSVParser<Header>;

// Overload: When outputFormat is a union type (dynamic/runtime determined)
export function createStringCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const OutputFormat extends "object" | "array" = "object" | "array",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options: StringCSVParserFactoryOptions<
    Header,
    Delimiter,
    Quotation,
    OutputFormat,
    Strategy
  >,
): StringArrayCSVParser<Header> | StringObjectCSVParser<Header>;

// Implementation signature
export function createStringCSVParser<
  const Header extends ReadonlyArray<string> = readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const OutputFormat extends "object" | "array" = "object" | "array",
  const Strategy extends ColumnCountStrategy = ColumnCountStrategy,
>(
  options?: StringCSVParserFactoryOptions<
    Header,
    Delimiter,
    Quotation,
    OutputFormat,
    Strategy
  >,
): StringArrayCSVParser<Header> | StringObjectCSVParser<Header> {
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

    const preferUtf16 = prefersUtf16(options);

    if (preferUtf16) {
      // UTF-16 path: Use direct UTF-16 parsers (no backend needed)
      return format === "array"
        ? (new WasmStringUtf16ArrayCSVParser<Header>(
            (options as any) ?? {},
          ) as any)
        : (new WasmStringUtf16ObjectCSVParser<Header>(
            (options as any) ?? {},
          ) as any);
    } else {
      // UTF-8 path: Use UTF-8 parsers with WasmIndexerBackend
      const delimiterCode = (options?.delimiter ?? ",").charCodeAt(0);
      const backend = new WasmIndexerBackend(delimiterCode);
      backend.initializeWithModule({
        scanCsvBytesStreaming,
        scanCsvBytesZeroCopy,
        isInitialized: isWasmInitialized,
        loadWasmSync,
      });

      return format === "array"
        ? (new WasmStringUtf8ArrayCSVParser<Header>(
            (options as any) ?? {},
            backend,
          ) as any)
        : (new WasmStringUtf8ObjectCSVParser<Header>(
            (options as any) ?? {},
            backend,
          ) as any);
    }
  }

  // JavaScript path (also SIMD fallback) - KEEP EXISTING CODE
  // Instantiate the appropriate class based on outputFormat
  // Each class explicitly implements its respective interface
  if (format === "array") {
    return new FlexibleStringArrayCSVParser<Header>(
      (options as any) ?? {},
    ) as any;
  } else {
    return new FlexibleStringObjectCSVParser<Header>(
      (options as any) ?? {},
    ) as any;
  }
}
