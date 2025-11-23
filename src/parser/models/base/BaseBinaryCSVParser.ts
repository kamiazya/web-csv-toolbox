import type {
  BinaryCSVProcessingOptions,
  CSVParserParseOptions,
  CSVRecord,
  StringCSVParser,
} from "@/core/types.ts";
import { createStringCSVParser } from "@/parser/api/model/createStringCSVParser.ts";

/**
 * Base class for Binary CSV Parsers.
 * Provides common implementation for both object and array output formats.
 * Combines TextDecoder with StringCSVParser for binary data parsing.
 *
 * @template Header - The type of the header row
 * @template Format - Output format: 'object' or 'array'
 *
 * @remarks
 * This is an internal base class. Use FlexibleBinaryObjectCSVParser or
 * FlexibleBinaryArrayCSVParser for concrete implementations, or use the
 * createBinaryCSVParser() factory function for type-safe instantiation.
 *
 * Uses {@link BinaryCSVProcessingOptions} which excludes execution strategy (engine).
 * Low-level parsers focus on CSV processing logic only.
 */
export abstract class BaseBinaryCSVParser<
  Header extends ReadonlyArray<string>,
  Format extends "object" | "array",
> {
  protected readonly decoder: TextDecoder;
  protected readonly stringParser: StringCSVParser<Header, Format>;

  constructor(
    options: BinaryCSVProcessingOptions<Header> = {} as BinaryCSVProcessingOptions<Header>,
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
      this.decoder = new TextDecoder(
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
    // createStringCSVParser returns the correct type based on outputFormat in options
    this.stringParser = createStringCSVParser<Header>(options) as StringCSVParser<
      Header,
      Format
    >;
  }

  /**
   * Parse a chunk of CSV binary data
   *
   * @param chunk - CSV binary chunk (BufferSource) to parse (optional for flush)
   * @param options - Parse options including stream mode
   * @returns Iterable iterator of parsed CSV records
   *
   * @remarks
   * When using streaming mode (`{ stream: true }`), you must call `parse()` without
   * arguments at the end to flush any remaining data from the TextDecoder buffer.
   */
  parse(
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVRecord<Header, Format>> {
    // Use streaming mode for TextDecoder based on options
    // When stream: true, TextDecoder keeps internal buffer for incomplete characters
    // When stream: false or undefined, TextDecoder flushes everything
    const stream = options?.stream ?? false;

    // Decode binary chunk to string
    // TextDecoder.decode() accepts BufferSource directly
    const csvString = this.decoder.decode(chunk, { stream });

    // Parse the decoded string using StringCSVParser
    // Type assertion is safe because CSVRecord<Header, Format> matches the string parser output
    return this.stringParser.parse(csvString, options) as IterableIterator<
      CSVRecord<Header, Format>
    >;
  }
}
