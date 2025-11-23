import type {
  BinaryArrayCSVParser,
  BinaryCSVProcessingOptions,
  BinaryObjectCSVParser,
} from "@/core/types.ts";
import { FlexibleBinaryArrayCSVParser } from "@/parser/models/FlexibleBinaryArrayCSVParser.ts";
import { FlexibleBinaryObjectCSVParser } from "@/parser/models/FlexibleBinaryObjectCSVParser.ts";

/**
 * Factory function to create the appropriate Binary CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @template Options - BinaryCSVProcessingOptions type (inferred from arguments)
 * @param options - Binary CSV processing specification (excludes execution strategy)
 * @returns A parser instance configured for the specified output format
 *
 * @remarks
 * This is a low-level factory function that accepts {@link BinaryCSVProcessingOptions}.
 * It does NOT accept execution strategy options (engine).
 * For high-level APIs with execution strategy support, use parseBinary() and related functions.
 *
 * This function provides both compile-time and runtime type safety.
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → BinaryObjectCSVParser (FlexibleBinaryObjectCSVParser)
 * - `outputFormat: 'array'` → BinaryArrayCSVParser (FlexibleBinaryArrayCSVParser)
 *
 * @example Object format (default)
 * ```ts
 * const parser = createBinaryCSVParser({
 *   header: ['name', 'age'] as const,
 *   charset: 'utf-8',
 *   decompression: 'gzip',
 *   signal: abortController.signal,
 *   // engine is NOT available (low-level API)
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
 *   // engine is NOT available (low-level API)
 * });
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\nBob,25'))) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
  Options extends BinaryCSVProcessingOptions<Header> = BinaryCSVProcessingOptions<Header>,
>(
  options?: Options,
): Options extends { outputFormat: "array" }
  ? BinaryArrayCSVParser<Header>
  : BinaryObjectCSVParser<Header> {
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
    return new FlexibleBinaryArrayCSVParser<Header>(options ?? {}) as any;
  } else {
    return new FlexibleBinaryObjectCSVParser<Header>(options ?? {}) as any;
  }
}
