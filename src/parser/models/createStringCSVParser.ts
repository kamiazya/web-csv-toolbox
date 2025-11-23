import type { ParseOptions } from "@/core/types.ts";
import { FlexibleStringCSVParser } from "@/parser/models/FlexibleStringCSVParser.ts";

/**
 * Create a new StringCSVParser instance.
 *
 * @template Header - The type of the header row
 * @param options - Parser options
 * @returns A new FlexibleStringCSVParser instance
 *
 * @example
 * ```ts
 * const parser = createStringCSVParser({ header: ['name', 'age'] });
 * const records = parser.parse('Alice,30\nBob,25');
 * console.log(records); // [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
 * ```
 */
export function createStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: ParseOptions<Header> = {} as ParseOptions<Header>,
): FlexibleStringCSVParser<Header> {
  return new FlexibleStringCSVParser<Header>(options);
}
