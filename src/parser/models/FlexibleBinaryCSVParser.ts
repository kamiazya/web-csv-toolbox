import type {
  CSVParserParseOptions,
  CSVRecord,
  ParseBinaryOptions,
} from "@/core/types.ts";
import { createStringCSVParser } from "@/parser/models/createStringCSVParser.ts";
import type { FlexibleStringCSVParser } from "@/parser/models/FlexibleStringCSVParser.ts";

/**
 * Flexible CSV Parser for binary input (BufferSource).
 * Combines TextDecoder (with streaming support) and FlexibleStringCSVParser.
 *
 * @template Header - The type of the header row
 * @template Format - Output format type ('object' | 'array')
 *
 * @remarks
 * Accepts any BufferSource type (Uint8Array, ArrayBuffer, or other TypedArray views).
 * For streaming mode, remember to call parse() without arguments at the end to flush
 * any remaining data from the TextDecoder buffer.
 *
 * @example Basic usage with Uint8Array
 * ```ts
 * const encoder = new TextEncoder();
 * const binary = encoder.encode('name,age\nAlice,30\nBob,25');
 * const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
 * const records = parser.parse(binary);
 * console.log(records); // [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
 * ```
 *
 * @example With ArrayBuffer
 * ```ts
 * const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
 * const buffer = await fetch('data.csv').then(r => r.arrayBuffer());
 * const records = parser.parse(buffer);
 * ```
 *
 * @example Streaming mode with TextDecoder streaming
 * ```ts
 * const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
 * const encoder = new TextEncoder();
 *
 * // Process chunks with streaming
 * const chunk1 = parser.parse(encoder.encode('Alice,30\nBob,'), { stream: true });
 * const chunk2 = parser.parse(encoder.encode('25\n'), { stream: true });
 * // Flush remaining data
 * const chunk3 = parser.parse();
 * ```
 */
export class FlexibleBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  #decoder: TextDecoder;
  #stringParser: FlexibleStringCSVParser<Header>;

  constructor(
    options: ParseBinaryOptions<Header> = {} as ParseBinaryOptions<Header>,
  ) {
    // Initialize TextDecoder with charset and options
    const decoderOptions: TextDecoderOptions = {};
    if (options?.ignoreBOM !== undefined) {
      decoderOptions.ignoreBOM = options.ignoreBOM;
    }
    if (options?.fatal !== undefined) {
      decoderOptions.fatal = options.fatal;
    }

    try {
      this.#decoder = new TextDecoder(
        options?.charset ?? "utf-8",
        decoderOptions,
      );
    } catch (error) {
      // If charset is invalid, provide clear error message
      if (error instanceof RangeError || error instanceof TypeError) {
        throw new RangeError(
          `Invalid or unsupported charset: "${options?.charset}". Please specify a valid charset.`,
        );
      }
      throw error;
    }

    // Initialize string parser with the same options
    this.#stringParser = createStringCSVParser<Header>(options);
  }

  /**
   * Parse a chunk of CSV binary data
   *
   * @param chunk - CSV binary chunk (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray) to parse (optional for flush)
   * @param options - Parse options including stream mode
   * @returns Array of parsed CSV records (type depends on outputFormat option)
   *
   * @remarks
   * When using streaming mode (`{ stream: true }`), you must call `parse()` without
   * arguments at the end to flush any remaining data from the TextDecoder buffer.
   *
   * @example Object format (default) with Uint8Array
   * ```ts
   * const encoder = new TextEncoder();
   * const binary = encoder.encode('Alice,30\nBob,25');
   * const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
   * const records = parser.parse(binary);
   * console.log(records); // [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
   * ```
   *
   * @example With ArrayBuffer
   * ```ts
   * const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
   * const buffer = await fetch('data.csv').then(r => r.arrayBuffer());
   * const records = parser.parse(buffer);
   * ```
   *
   * @example Streaming mode with TextDecoder
   * ```ts
   * const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
   * const encoder = new TextEncoder();
   *
   * // First chunk with stream: true to keep decoder buffer
   * const records1 = parser.parse(encoder.encode('Alice,30\nBob,'), { stream: true });
   *
   * // Second chunk with stream: true
   * const records2 = parser.parse(encoder.encode('25\n'), { stream: true });
   *
   * // Final flush call without chunk to get remaining data
   * const records3 = parser.parse();
   * ```
   */
  parse(
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): CSVRecord<Header>[] {
    // Use streaming mode for TextDecoder based on options
    // When stream: true, TextDecoder keeps internal buffer for incomplete characters
    // When stream: false or undefined, TextDecoder flushes everything
    const stream = options?.stream ?? false;

    // Decode binary chunk to string
    // TextDecoder.decode() accepts BufferSource directly
    const csvString = this.#decoder.decode(chunk, { stream });

    // Parse the decoded string using StringCSVParser
    return this.#stringParser.parse(csvString, options);
  }
}
