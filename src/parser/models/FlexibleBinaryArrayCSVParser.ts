import type {
  BinaryArrayCSVParser,
  BinaryCSVProcessingOptions,
} from "@/core/types.ts";
import { BaseBinaryCSVParser } from "@/parser/models/base/BaseBinaryCSVParser.ts";

/**
 * Flexible CSV Parser for binary input with array output format.
 * Combines TextDecoder and StringCSVParser to return records as arrays.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements BinaryArrayCSVParser interface and enforces array output format.
 * For type-safe usage, use the createBinaryCSVParser() factory function.
 *
 * Accepts any BufferSource type (Uint8Array, ArrayBuffer, or other TypedArray views).
 *
 * This is a low-level API that accepts {@link BinaryCSVProcessingOptions} (excluding execution strategy).
 * For high-level APIs with execution strategy support, use parseBinary() and related functions.
 *
 * @example
 * ```ts
 * const encoder = new TextEncoder();
 * const parser = new FlexibleBinaryArrayCSVParser({
 *   header: ['name', 'age'] as const,
 *   charset: 'utf-8',
 *   decompression: 'gzip',
 *   signal: abortController.signal,
 *   // engine is NOT available (low-level API)
 * });
 * const binary = encoder.encode('Alice,30\nBob,25');
 * for (const record of parser.parse(binary)) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export class FlexibleBinaryArrayCSVParser<
    Header extends ReadonlyArray<string> = readonly string[],
  >
  extends BaseBinaryCSVParser<Header, "array">
  implements BinaryArrayCSVParser<Header>
{
  constructor(
    options: BinaryCSVProcessingOptions<Header> = {} as BinaryCSVProcessingOptions<Header>,
  ) {
    // Enforce array output format regardless of what caller passes
    super({ ...options, outputFormat: "array" as const });
  }
}
