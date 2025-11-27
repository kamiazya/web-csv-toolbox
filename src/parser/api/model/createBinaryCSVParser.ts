import type {
  BinaryArrayCSVParser,
  BinaryCSVProcessingOptions,
  BinaryObjectCSVParser,
  FactoryEngineOptions,
} from "@/core/types.ts";
import { FlexibleBinaryArrayCSVParser } from "@/parser/models/FlexibleBinaryArrayCSVParser.ts";
import { FlexibleBinaryObjectCSVParser } from "@/parser/models/FlexibleBinaryObjectCSVParser.ts";
import { WASMBinaryCSVArrayParser } from "@/parser/models/WASMBinaryCSVArrayParser.ts";
import { WASMBinaryObjectCSVParser } from "@/parser/models/WASMBinaryObjectCSVParser.ts";
import {
  validateWASMCharset,
  validateWASMOptions,
} from "@/parser/utils/wasmValidation.ts";

/**
 * Factory function to create the appropriate Binary CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @template Options - BinaryCSVProcessingOptions type (inferred from arguments)
 * @param options - Binary CSV processing specification including optional engine configuration
 * @returns A parser instance configured for the specified output format and engine
 *
 * @remarks
 * This factory function supports both JavaScript and WASM implementations.
 * Use `engine: { wasm: true }` to use the WASM implementation for better performance.
 *
 * **WASM Constraints:**
 * - Charset must be UTF-8 (or undefined, which defaults to UTF-8)
 * - Delimiter must be a single character
 * - Quotation must be a single character
 *
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → BinaryObjectCSVParser
 * - `outputFormat: 'array'` → BinaryArrayCSVParser
 *
 * @example JavaScript implementation (default)
 * ```ts
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'] as const,
 * });
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\nBob,25'))) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example WASM implementation
 * ```ts
 * import { loadWASM, createBinaryCSVParser } from 'web-csv-toolbox';
 *
 * await loadWASM();
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'] as const,
 *   engine: { wasm: true }
 * });
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\nBob,25'))) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example Array format with WASM
 * ```ts
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'array',
 *   engine: { wasm: true }
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
  options: Omit<BinaryCSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "array";
    },
): BinaryArrayCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<BinaryCSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "object";
    },
): BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<BinaryCSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "object" | "array";
    },
): BinaryArrayCSVParser<Header> | BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: BinaryCSVProcessingOptions<Header> & FactoryEngineOptions,
): BinaryObjectCSVParser<Header>;

export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: BinaryCSVProcessingOptions<Header> & FactoryEngineOptions,
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
  if (options?.engine?.wasm) {
    // Validate WASM constraints
    validateWASMCharset(options?.charset); // UTF-8 only
    validateWASMOptions(options); // single-char delimiter/quotation

    // Instantiate WASM parser based on outputFormat
    if (format === "array") {
      return new WASMBinaryCSVArrayParser<Header>({
        delimiter: options?.delimiter ?? ",",
        quotation: options?.quotation ?? '"',
        maxFieldCount: options?.maxFieldCount,
        header: options?.header,
      }) as BinaryArrayCSVParser<Header>;
    } else {
      return new WASMBinaryObjectCSVParser<Header>({
        delimiter: options?.delimiter ?? ",",
        quotation: options?.quotation ?? '"',
        maxFieldCount: options?.maxFieldCount,
        header: options?.header,
      }) as BinaryObjectCSVParser<Header>;
    }
  }

  // Default: JavaScript implementation
  if (format === "array") {
    return new FlexibleBinaryArrayCSVParser<Header>(options ?? {}) as any;
  } else {
    return new FlexibleBinaryObjectCSVParser<Header>(options ?? {}) as any;
  }
}
