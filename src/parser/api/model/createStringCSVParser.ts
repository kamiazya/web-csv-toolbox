import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  ColumnCountStrategy,
  StringArrayCSVParser,
  StringCSVParserFactoryOptions,
  StringObjectCSVParser,
} from "@/core/types.ts";
import { FlexibleStringArrayCSVParser } from "@/parser/models/FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "@/parser/models/FlexibleStringObjectCSVParser.ts";

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
