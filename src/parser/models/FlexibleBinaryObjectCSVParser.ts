import type {
  BinaryObjectCSVParser,
  ParseBinaryOptions,
} from "@/core/types.ts";
import { BaseBinaryCSVParser } from "@/parser/models/base/BaseBinaryCSVParser.ts";

/**
 * Flexible CSV Parser for binary input with object output format.
 * Combines TextDecoder and StringCSVParser to return records as objects.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements BinaryObjectCSVParser interface.
 * For type-safe usage, use the createBinaryCSVParser() factory function.
 *
 * Accepts any BufferSource type (Uint8Array, ArrayBuffer, or other TypedArray views).
 *
 * @example
 * ```ts
 * const encoder = new TextEncoder();
 * const parser = new FlexibleBinaryObjectCSVParser({
 *   header: ['name', 'age'] as const,
 *   charset: 'utf-8'
 * });
 * const binary = encoder.encode('Alice,30\nBob,25');
 * for (const record of parser.parse(binary)) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 */
export class FlexibleBinaryObjectCSVParser<
    Header extends ReadonlyArray<string> = readonly string[],
  >
  extends BaseBinaryCSVParser<Header, "object">
  implements BinaryObjectCSVParser<Header>
{
  constructor(
    options: ParseBinaryOptions<Header> = {} as ParseBinaryOptions<Header>,
  ) {
    // Enforce object output format regardless of what caller passes
    super({ ...options, outputFormat: "object" as const });
  }
}
