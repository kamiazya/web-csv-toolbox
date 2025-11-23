import type { ParseOptions, StringObjectCSVParser } from "@/core/types.ts";
import { BaseStringCSVParser } from "@/parser/models/base/BaseStringCSVParser.ts";

/**
 * Flexible CSV Parser for string input with object output format.
 * Combines StringCSVLexer and CSVRecordAssembler to return records as objects.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements StringObjectCSVParser interface.
 * For type-safe usage, use the createStringCSVParser() factory function.
 *
 * @example
 * ```ts
 * const parser = new FlexibleStringObjectCSVParser({ header: ['name', 'age'] as const });
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
  constructor(options: ParseOptions<Header> = {} as ParseOptions<Header>) {
    // Enforce object output format regardless of what caller passes
    super({ ...options, outputFormat: "object" as const });
  }
}
