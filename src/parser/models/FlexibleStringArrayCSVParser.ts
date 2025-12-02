import type {
  CSVProcessingOptions,
  StringArrayCSVParser,
} from "@/core/types.ts";
import { BaseStringCSVParser } from "@/parser/models/base/BaseStringCSVParser.ts";

/**
 * Flexible CSV Parser for string input with array output format.
 * Combines StringCSVLexer and CSVRecordAssembler to return records as arrays.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements StringArrayCSVParser interface and enforces array output format.
 * For type-safe usage, use the createStringCSVParser() factory function.
 *
 * This is a low-level API that accepts {@link CSVProcessingOptions} (excluding execution strategy).
 * For high-level APIs with execution strategy support, use parseString() and related functions.
 *
 * @example
 * ```ts
 * const parser = new FlexibleStringArrayCSVParser({
 *   header: ['name', 'age'] as const,
 *   delimiter: ',',
 *   signal: abortController.signal,
 *   // engine is NOT available (low-level API)
 * });
 * const records = parser.parse('Alice,30\nBob,25');
 * for (const record of records) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export class FlexibleStringArrayCSVParser<
    const Header extends ReadonlyArray<string> = readonly string[],
  >
  extends BaseStringCSVParser<Header, "array">
  implements StringArrayCSVParser<Header>
{
  constructor(
    options: CSVProcessingOptions<Header> = {} as CSVProcessingOptions<Header>,
  ) {
    // Enforce array output format regardless of what caller passes
    super({ ...options, outputFormat: "array" as const });
  }
}
