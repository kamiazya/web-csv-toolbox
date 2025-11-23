import type { ParseBinaryOptions } from "@/core/types.ts";
import { FlexibleBinaryCSVParser } from "@/parser/models/FlexibleBinaryCSVParser.ts";

/**
 * Create a new BinaryCSVParser instance.
 *
 * @template Header - The type of the header row
 * @param options - Parser options (including charset, ignoreBOM, fatal)
 * @returns A new FlexibleBinaryCSVParser instance
 *
 * @example
 * ```ts
 * const parser = createBinaryCSVParser({ header: ['name', 'age'], charset: 'utf-8' });
 * const encoder = new TextEncoder();
 * const binary = encoder.encode('Alice,30\nBob,25');
 * const records = parser.parse(binary);
 * console.log(records); // [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
 * ```
 */
export function createBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
>(
  options: ParseBinaryOptions<Header> = {} as ParseBinaryOptions<Header>,
): FlexibleBinaryCSVParser<Header> {
  return new FlexibleBinaryCSVParser<Header>(options);
}
