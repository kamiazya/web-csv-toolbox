import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../constants.ts";
import type { Join } from "../utils/types.ts";
import type { Field, FieldDelimiter, RecordDelimiter } from "./constants.ts";

/**
 * Position object.
 */
export interface Position {
  /**
   * Line number.
   * Starts from 1.
   */
  line: number;
  /**
   * Column number.
   * Starts from 1.
   */
  column: number;
  /**
   * Character offset.
   * Starts from 0.
   */
  offset: number;
}

/**
 * Token location object.
 */
export interface TokenLocation {
  /**
   * Start location.
   */
  start: Position;
  /**
   * End location.
   */
  end: Position;
  /**
   * Row number.
   * Starts from 1.
   *
   * @remarks
   * This represents the logical row number in the CSV,
   * counting from 1 for the first row, whether it is a header or not.
   */
  rowNumber: number;
}

/**
 * Field token type.
 * @category Types
 */
export interface FieldToken {
  type: typeof Field;
  value: string;
  location: TokenLocation;
}

/**
 * Field delimiter token type.
 * @category Types
 */
export interface FieldDelimiterToken {
  type: typeof FieldDelimiter;
  value: string;
  location: TokenLocation;
}

/**
 * Record delimiter token type.
 * @category Types
 */
export interface RecordDelimiterToken {
  type: typeof RecordDelimiter;
  value: string;
  location: TokenLocation;
}

/**
 * Token is a atomic unit of a CSV file.
 * It can be a field, field delimiter, or record delimiter.
 * @category Types
 */
export type Token = FieldToken | FieldDelimiterToken | RecordDelimiterToken;

/**
 * AbortSignal Options.
 *
 * @category Types
 */
export interface AbortSignalOptions {
  /**
   * The signal to abort the operation.
   *
   * @remarks
   *
   * If the signal is aborted, the operation will be stopped.
   *
   * @example Abort with user action
   *
   * ```ts
   * const controller = new AbortController();
   *
   * const csv = "foo,bar\n1,2\n3,4";
   * try {
   *   const result = await parse(csv, { signal: controller.signal });
   * } catch (e) {
   *   if (e instanceof DOMException && e.name === "AbortError") {
   *     console.log("Aborted");
   *   }
   * }
   *
   * // Abort with user action
   * document.getElementById("cancel-button")
   *  .addEventListener("click", () => {
   *    controller.abort();
   *   });
   * ```
   *
   * @example Abort with timeout
   *
   * ```ts
   * const csv = "foo,bar\n1,2\n3,4";
   *
   * try {
   *   const result = await parse(csv, { signal: AbortSignal.timeout(1000) });
   * } catch (e) {
   *   if (e instanceof DOMException && e.name === "TimeoutError") {
   *     console.log("Timeout");
   *   }
   * }
   * ```
   *
   * @default undefined
   */
  signal?: AbortSignal;
}

/**
 * CSV Common Options.
 * @category Types
 */
export interface CommonOptions<
  Delimiter extends string,
  Quotation extends string,
> {
  /**
   * CSV field delimiter.
   * If you want to parse TSV, specify `'\t'`.
   *
   * @remarks
   * Detail restrictions are as follows:
   *
   * - Must not be empty
   * - Must be a single character
   *    - Multi-byte characters are not supported
   * - Must not include CR or LF
   * - Must not be the same as the quotation
   *
   * @default ','
   */
  delimiter?: Delimiter;
  /**
   * CSV field quotation.
   *
   * @default '"'
   */
  quotation?: Quotation;
  /**
   * Maximum internal buffer size in characters.
   *
   * @remarks
   * This option limits the size of the internal buffer used during lexing
   * to prevent memory exhaustion attacks. The buffer size is measured in
   * UTF-16 code units (JavaScript string length). When the buffer exceeds
   * this limit, a `RangeError` will be thrown.
   *
   * Set to `Infinity` to disable the limit (not recommended for untrusted input).
   *
   * @default 10 * 1024 * 1024 (approximately 10MB for ASCII, but may vary for non-ASCII)
   */
  maxBufferSize?: number;
}

/**
 * CSV Parsing Options for binary.
 * @category Types
 */
export interface BinaryOptions {
  /**
   * If the binary is compressed by a compression algorithm,
   * the decompressed CSV can be parsed by specifying the algorithm.
   *
   * @remarks
   * Make sure the runtime you are running supports stream decompression.
   *
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream#browser_compatibility | DecompressionStream Compatibility}.
   */
  decomposition?: CompressionFormat;
  /**
   * You can specify the character encoding of the binary.
   *
   * @remarks
   * {@link !TextDecoderStream} is used internally.
   *
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings | Encoding API Compatibility}
   * for the encoding formats that can be specified.
   *
   * @default 'utf-8'
   */
  charset?: string;
  /**
   * Maximum binary size in bytes for ArrayBuffer/Uint8Array inputs.
   *
   * @remarks
   * This option limits the size of ArrayBuffer or Uint8Array inputs
   * to prevent memory exhaustion attacks. When the binary size exceeds
   * this limit, a `RangeError` will be thrown.
   *
   * Set to `Number.POSITIVE_INFINITY` to disable the limit (not recommended for untrusted input).
   *
   * @default 100 * 1024 * 1024 (100MB)
   */
  maxBinarySize?: number;
  /**
   * If the binary has a BOM, you can specify whether to ignore it.
   *
   * @remarks
   * If you specify true, the BOM will be ignored.
   * If you specify false or not specify it, the BOM will be treated as a normal character.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/ignoreBOM | TextDecoderOptions.ignoreBOM} for more information about the BOM.
   * @default false
   */
  ignoreBOM?: boolean;
  /**
   * If the binary has a invalid character, you can specify whether to throw an error.
   *
   * @remarks
   * If the property is `true` then a decoder will throw a {@link !TypeError}
   * if it encounters malformed data while decoding.
   *
   * If `false` the decoder will substitute the invalid data
   * with the replacement character `U+FFFD` (�).
   *
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/fatal | TextDecoderOptions.fatal} for more information.
   *
   * @default false
   */
  fatal?: boolean;
  /**
   * Allow experimental or future compression formats not explicitly supported by this library.
   *
   * @remarks
   * When `true`, unknown compression formats from Content-Encoding headers will be passed
   * to the runtime's DecompressionStream without validation. This allows using newer
   * compression formats (like Brotli) if your runtime supports them, even before this
   * library is updated to explicitly support them.
   *
   * When `false` (default), only known formats are allowed: gzip, deflate, deflate-raw.
   *
   * **Use with caution**: Enabling this bypasses library validation and relies entirely
   * on runtime error handling. If the runtime doesn't support the format, you'll get
   * a runtime error instead of a clear validation error from this library.
   *
   * @default false
   *
   * @example
   * ```ts
   * // Safe mode (default): Only known formats
   * const response = await fetch('data.csv.gz');
   * await parse(response); // ✓ Works
   *
   * // Experimental mode: Allow future formats
   * const response = await fetch('data.csv.br'); // Brotli
   * await parse(response, { allowExperimentalCompressions: true });
   * // Works if runtime supports Brotli, otherwise throws runtime error
   * ```
   */
  allowExperimentalCompressions?: boolean;
}

/**
 * CSV Lexer Transformer Options.
 * @category Types
 */
export interface CSVLexerTransformerOptions<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends CommonOptions<Delimiter, Quotation>,
    AbortSignalOptions {
  /**
   * Strategy for controlling the writable side's internal queue.
   *
   * @remarks
   * Controls backpressure for incoming string chunks. Higher `highWaterMark`
   * values allow more chunks to be buffered, improving throughput at the
   * cost of memory usage.
   *
   * **Note**: The default value is a starting point based on data flow
   * characteristics, not benchmarked performance. Optimal values depend on
   * your runtime environment (browser/Node.js/Deno), data size, and
   * performance requirements. Profile your specific use case and adjust
   * accordingly.
   *
   * @default { highWaterMark: 8 }
   *
   * @example
   * ```ts
   * // Customize based on your profiling results
   * const transformer = new CSVLexerTransformer({
   *   writableStrategy: { highWaterMark: 32 }
   * });
   * ```
   */
  writableStrategy?: QueuingStrategy<string>;

  /**
   * Strategy for controlling the readable side's internal queue.
   *
   * @remarks
   * Controls backpressure for outgoing token arrays. Higher `highWaterMark`
   * values allow more token arrays to be buffered before applying backpressure.
   *
   * The default value is set higher than writable side because the lexer
   * typically produces more output (tokens) than input (string chunks).
   *
   * **Note**: The default value is a starting point based on data flow
   * characteristics, not benchmarked performance. Optimal values depend on
   * your runtime environment (browser/Node.js/Deno), data size, and
   * performance requirements. Profile your specific use case and adjust
   * accordingly.
   *
   * @default { highWaterMark: 16 }
   *
   * @example
   * ```ts
   * // Customize based on your profiling results
   * const transformer = new CSVLexerTransformer({
   *   readableStrategy: { highWaterMark: 4 }
   * });
   * ```
   */
  readableStrategy?: QueuingStrategy<Token[]>;
}

/**
 * CSV Record Assembler Options.
 * @category Types
 *
 * @remarks
 * If you specify `header: ['foo', 'bar']`,
 * the first record will be treated as a normal record.
 *
 * If you don't specify `header`,
 * the first record will be treated as a header.
 */
export interface CSVRecordAssemblerOptions<Header extends ReadonlyArray<string>>
  extends AbortSignalOptions {
  /**
   * CSV header.
   *
   * @remarks
   * If you specify this option,
   * the first record will be treated as a normal record.
   *
   * If you don't specify this option,
   * the first record will be treated as a header.
   *
   * @default undefined
   */
  header?: Header;
  /**
   * Maximum number of fields allowed per record.
   *
   * @remarks
   * This option limits the number of columns/fields in a CSV record
   * to prevent memory exhaustion attacks. When a record exceeds this limit,
   * a {@link FieldCountLimitError} will be thrown.
   *
   * Set to `Number.POSITIVE_INFINITY` to disable the limit (not recommended for untrusted input).
   *
   * @default 100000
   */
  maxFieldCount?: number;

  /**
   * When true, completely empty lines (with only delimiters or whitespace)
   * will be skipped during parsing.
   *
   * @default false
   */
  skipEmptyLines?: boolean;

  /**
   * Strategy for controlling the writable side's internal queue.
   *
   * @remarks
   * Controls backpressure for incoming token arrays. Higher `highWaterMark`
   * values allow more token arrays to be buffered, improving throughput at
   * the cost of memory usage.
   *
   * The default value is set higher than readable side because the assembler
   * typically receives multiple token arrays to produce a single record.
   *
   * **Note**: The default value is a starting point based on data flow
   * characteristics, not benchmarked performance. Optimal values depend on
   * your runtime environment (browser/Node.js/Deno), data size, and
   * performance requirements. Profile your specific use case and adjust
   * accordingly.
   *
   * @default { highWaterMark: 16 }
   *
   * @example
   * ```ts
   * // Customize based on your profiling results
   * const transformer = new CSVRecordAssemblerTransformer({
   *   writableStrategy: { highWaterMark: 64 }
   * });
   * ```
   */
  writableStrategy?: QueuingStrategy<Token[]>;

  /**
   * Strategy for controlling the readable side's internal queue.
   *
   * @remarks
   * Controls backpressure for outgoing CSV records. Higher `highWaterMark`
   * values allow more records to be buffered before applying backpressure.
   *
   * **Note**: The default value is a starting point based on data flow
   * characteristics, not benchmarked performance. Optimal values depend on
   * your runtime environment (browser/Node.js/Deno), data size, and
   * performance requirements. Profile your specific use case and adjust
   * accordingly.
   *
   * @default { highWaterMark: 8 }
   *
   * @example
   * ```ts
   * // Customize based on your profiling results
   * const transformer = new CSVRecordAssemblerTransformer({
   *   readableStrategy: { highWaterMark: 2 }
   * });
   * ```
   */
  readableStrategy?: QueuingStrategy<CSVRecord<Header>>;
}

/**
 * Parse options for CSV string.
 * @category Types
 */
export interface ParseOptions<
  Header extends ReadonlyArray<string> = ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends CommonOptions<Delimiter, Quotation>,
    Omit<CSVRecordAssemblerOptions<Header>, "writableStrategy" | "readableStrategy">,
    AbortSignalOptions {}

/**
 * Parse options for CSV binary.
 * @category Types
 */
export interface ParseBinaryOptions<Header extends ReadonlyArray<string>>
  extends ParseOptions<Header>,
    BinaryOptions {}

/**
 * CSV Record.
 * @category Types
 * @template Header Header of the CSV.
 *
 * @example Header is ["foo", "bar"]
 * ```ts
 * const record: CSVRecord<["foo", "bar"]> = {
 *   foo: "1",
 *   bar: "2",
 * };
 * ```
 */
export type CSVRecord<Header extends ReadonlyArray<string>> = Record<
  Header[number],
  string
>;

/**
 * CSV String.
 *
 * @category Types
 */
export type CSVString<
  Header extends ReadonlyArray<string> = [],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> = Header extends readonly [string, ...string[]]
  ?
      | Join<Header, Delimiter, Quotation>
      | ReadableStream<Join<Header, Delimiter, Quotation>>
  : string | ReadableStream<string>;

/**
 * CSV Binary.
 *
 * @category Types
 */
export type CSVBinary =
  | ReadableStream<Uint8Array>
  | Response
  | ArrayBuffer
  | Uint8Array;

/**
 * CSV.
 *
 * @category Types
 */
export type CSV<
  Header extends ReadonlyArray<string> = [],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> = Header extends []
  ? CSVString | CSVBinary
  : CSVString<Header, Delimiter, Quotation>;
