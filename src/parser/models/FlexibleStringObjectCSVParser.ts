import type {
  CSVProcessingOptions,
  StringObjectCSVParser,
} from "@/core/types.ts";
import { BaseStringCSVParser } from "@/parser/models/base/BaseStringCSVParser.ts";

/**
 * Flexible CSV Parser for string input with object output format.
 * Combines StringCSVLexer and CSVRecordAssembler to return records as objects.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements StringObjectCSVParser interface and enforces object output format.
 * For type-safe usage, use the createStringCSVParser() factory function.
 *
 * This is a low-level API that accepts {@link CSVProcessingOptions} (excluding execution strategy).
 * For high-level APIs with execution strategy support, use parseString() and related functions.
 *
 * @example
 * ```ts
 * const parser = new FlexibleStringObjectCSVParser({
 *   header: ['name', 'age'] as const,
 *   delimiter: ',',
 *   signal: abortController.signal,
 *   // engine is NOT available (low-level API)
 * });
 * const records = parser.parse('Alice,30\nBob,25');
 * for (const record of records) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 */
export class FlexibleStringObjectCSVParser<
    Header extends ReadonlyArray<string> = readonly string[],
  >
  extends BaseStringCSVParser<Header, "object">
  implements StringObjectCSVParser<Header>
{
  constructor(
    options: CSVProcessingOptions<Header> = {} as CSVProcessingOptions<Header>,
  ) {
    // Enforce object output format regardless of what caller passes
    super({ ...options, outputFormat: "object" as const });
  }
}
