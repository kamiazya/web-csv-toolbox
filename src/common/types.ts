import { Field, FieldDelimiter, RecordDelimiter } from "./constants.js";

/**
 * Token is a atomic unit of a CSV file.
 * It can be a field, field delimiter, or record delimiter.
 * @category Types
 *
 * @example
 * ```ts
 * const fieldToken: Token = { type: Field, value: "foo" };
 * const fieldDelimiterToken: Token = { type: FieldDelimiter, value: "," };
 * const recordDelimiterToken: Token = { type: RecordDelimiter, value: "\n" };
 * ```
 */
export interface Token<T extends TokenType = TokenType> {
  type: T;
  value: string;
}

/**
 * Type of a token for CSV.
 * @category Types
 */
export type TokenType =
  | typeof FieldDelimiter
  | typeof RecordDelimiter
  | typeof Field;

/**
 * CSV Common Options.
 * @category Types
 */
export interface CommonOptions {
  /**
   * CSV field delimiter.
   *
   * @remarks
   * If you want to parse TSV, specify `'\t'`.
   *
   * This library supports multi-character delimiters.
   * @default ','
   */
  demiliter?: string;
  /**
   * CSV field quotation.
   *
   * @remarks
   * This library supports multi-character quotations.
   *
   * @default '"'
   */
  quotation?: string;
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
}

/**
 * Record Assembler Options for CSV.
 * @category Types
 *
 * @remarks
 * If you specify `header: ['foo', 'bar']`,
 * the first record will be treated as a normal record.
 *
 * If you don't specify `header`,
 * the first record will be treated as a header.
 */
export interface RecordAssemblerOptions<Header extends ReadonlyArray<string>> {
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
}

/**
 * Parse options for CSV string.
 * @category Types
 */
export interface ParseOptions<Header extends ReadonlyArray<string>>
  extends CommonOptions,
    RecordAssemblerOptions<Header> {}

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
