import type { ParseOptions, StringArrayCSVParser } from "@/core/types.ts";
import { BaseStringCSVParser } from "@/parser/models/base/BaseStringCSVParser.ts";

/**
 * Flexible CSV Parser for string input with array output format.
 * Combines StringCSVLexer and CSVRecordAssembler to return records as arrays.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements StringArrayCSVParser interface.
 * For type-safe usage, use the createStringCSVParser() factory function.
 *
 * @example
 * ```ts
 * const parser = new FlexibleStringArrayCSVParser({
 *   header: ['name', 'age'] as const
 * });
 * const records = parser.parse('Alice,30\nBob,25');
 * for (const record of records) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export class FlexibleStringArrayCSVParser<
    Header extends ReadonlyArray<string> = readonly string[],
  >
  extends BaseStringCSVParser<Header, "array">
  implements StringArrayCSVParser<Header>
{
  constructor(options: ParseOptions<Header> = {} as ParseOptions<Header>) {
    // Enforce array output format regardless of what caller passes
    super({ ...options, outputFormat: "array" as const });
  }
}
