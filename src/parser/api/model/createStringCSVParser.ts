import type {
  CSVProcessingOptions,
  FactoryEngineOptions,
  StringArrayCSVParser,
  StringObjectCSVParser,
} from "@/core/types.ts";
import { FlexibleStringArrayCSVParser } from "@/parser/models/FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "@/parser/models/FlexibleStringObjectCSVParser.ts";
import { WASMStringCSVArrayParser } from "@/parser/models/WASMStringCSVArrayParser.ts";
import { WASMStringObjectCSVParser } from "@/parser/models/WASMStringObjectCSVParser.ts";
import { validateWASMOptions } from "@/parser/utils/wasmValidation.ts";

/**
 * Factory function to create the appropriate String CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @template Options - CSVProcessingOptions type (inferred from arguments)
 * @param options - CSV processing specification including optional engine configuration
 * @returns A parser instance configured for the specified output format and engine
 *
 * @remarks
 * This factory function supports both JavaScript and WASM implementations.
 * Use `engine: { wasm: true }` to use the WASM implementation for better performance.
 *
 * **WASM Constraints:**
 * - Delimiter must be a single character
 * - Quotation must be a single character
 *
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → StringObjectCSVParser
 * - `outputFormat: 'array'` → StringArrayCSVParser
 *
 * @example JavaScript implementation (default)
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example WASM implementation
 * ```ts
 * import { loadWASM, createStringCSVParser } from 'web-csv-toolbox';
 *
 * await loadWASM();
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 *   engine: { wasm: true }
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example Array format with WASM
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'array',
 *   engine: { wasm: true }
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<CSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "array";
    },
): StringArrayCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<CSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "object";
    },
): StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: Omit<CSVProcessingOptions<Header>, "outputFormat"> &
    FactoryEngineOptions & {
      outputFormat: "object" | "array";
    },
): StringArrayCSVParser<Header> | StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: CSVProcessingOptions<Header> & FactoryEngineOptions,
): StringObjectCSVParser<Header>;

export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options?: CSVProcessingOptions<Header> & FactoryEngineOptions,
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

  // Check if WASM engine is requested
  if (options?.engine?.wasm) {
    // Validate WASM constraints (single-char delimiter/quotation)
    validateWASMOptions(options);

    // Instantiate WASM parser based on outputFormat
    if (format === "array") {
      return new WASMStringCSVArrayParser<Header>({
        delimiter: options?.delimiter ?? ",",
        quotation: options?.quotation ?? '"',
        maxFieldCount: options?.maxFieldCount,
        header: options?.header,
      }) as StringArrayCSVParser<Header>;
    } else {
      return new WASMStringObjectCSVParser<Header>({
        delimiter: options?.delimiter ?? ",",
        quotation: options?.quotation ?? '"',
        maxFieldCount: options?.maxFieldCount,
        header: options?.header,
      }) as StringObjectCSVParser<Header>;
    }
  }

  // Default: JavaScript implementation
  if (format === "array") {
    return new FlexibleStringArrayCSVParser<Header>(options ?? {}) as any;
  } else {
    return new FlexibleStringObjectCSVParser<Header>(options ?? {}) as any;
  }
}
