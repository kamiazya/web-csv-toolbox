import type {
  CSVProcessingOptions,
  StringArrayCSVParser,
  StringObjectCSVParser,
} from "@/core/types.ts";
import { FlexibleStringArrayCSVParser } from "@/parser/models/FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "@/parser/models/FlexibleStringObjectCSVParser.ts";

/**
 * Factory function to create the appropriate String CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @template Options - CSVProcessingOptions type (inferred from arguments)
 * @param options - CSV processing specification (excludes execution strategy)
 * @returns A parser instance configured for the specified output format
 *
 * @remarks
 * This is a low-level factory function that accepts {@link CSVProcessingOptions}.
 * It does NOT accept execution strategy options (engine).
 * For high-level APIs with execution strategy support, use parseString() and related functions.
 *
 * This function provides both compile-time and runtime type safety.
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → StringObjectCSVParser (FlexibleStringObjectCSVParser)
 * - `outputFormat: 'array'` → StringArrayCSVParser (FlexibleStringArrayCSVParser)
 *
 * @example Object format (default)
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 *   delimiter: ',',
 *   signal: abortController.signal,
 *   // engine is NOT available (low-level API)
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example Array format
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'array',
 *   // engine is NOT available (low-level API)
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
  Options extends CSVProcessingOptions<Header> = CSVProcessingOptions<Header>,
>(
  options?: Options,
): Options extends { outputFormat: "array" }
  ? StringArrayCSVParser<Header>
  : StringObjectCSVParser<Header> {
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

  // Instantiate the appropriate class based on outputFormat
  // Each class explicitly implements its respective interface
  if (format === "array") {
    return new FlexibleStringArrayCSVParser<Header>(options ?? {}) as any;
  } else {
    return new FlexibleStringObjectCSVParser<Header>(options ?? {}) as any;
  }
}
