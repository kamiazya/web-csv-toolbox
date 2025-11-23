import type {
  ParseOptions,
  StringArrayCSVParser,
  StringObjectCSVParser,
} from "@/core/types.ts";
import { FlexibleStringArrayCSVParser } from "@/parser/models/FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "@/parser/models/FlexibleStringObjectCSVParser.ts";

/**
 * Factory function to create the appropriate String CSV parser based on options.
 *
 * @template Header - The type of the header row
 * @template Options - ParseOptions type (inferred from arguments)
 * @param options - Parser options including outputFormat
 * @returns A parser instance configured for the specified output format
 *
 * @remarks
 * This function provides both compile-time and runtime type safety.
 * The return type is determined by the outputFormat option:
 * - `outputFormat: 'object'` (default) → StringObjectCSVParser (FlexibleStringObjectCSVParser)
 * - `outputFormat: 'array'` → StringArrayCSVParser (FlexibleStringArrayCSVParser)
 *
 * @example Object format (default)
 * ```ts
 * const parser = createStringCSVParser({ header: ['name', 'age'] as const });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 *
 * @example Array format
 * ```ts
 * const parser = createStringCSVParser({
 *   header: ['name', 'age'] as const,
 *   outputFormat: 'array'
 * });
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
  Options extends ParseOptions<Header> = ParseOptions<Header>,
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
