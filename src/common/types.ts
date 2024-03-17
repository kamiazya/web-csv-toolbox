import type { COMMA, CR, CRLF, DOUBLE_QUOTE, LF } from "../constants.ts";
import type { Field, FieldDelimiter, RecordDelimiter } from "./constants.ts";

/**
 * Field token type.
 * @category Types
 */
export interface FieldToken {
  type: typeof Field;
  value: string;
}

/**
 * Token is a atomic unit of a CSV file.
 * It can be a field, field delimiter, or record delimiter.
 * @category Types
 */
export type Token = FieldToken | typeof FieldDelimiter | typeof RecordDelimiter;

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
  delimiter?: string;
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

type Split<
  Char extends string,
  Delimiter extends string = typeof COMMA,
> = Char extends `${infer F}${Delimiter}${infer R}`
  ? [F, ...Split<R, Delimiter>]
  : [Char];

type Join<
  Chars extends ReadonlyArray<string | number | boolean | bigint>,
  Delimiter extends string = typeof COMMA,
> = Chars extends readonly [infer F, ...infer R]
  ? F extends string
    ? R extends string[]
      ? `${F}${R extends [] ? "" : Delimiter}${Join<R, Delimiter>}`
      : string
    : string
  : "";

type Newline = typeof CR | typeof CRLF | typeof LF;

type InferHeader<
  CSVSource extends string,
  Quotation extends string = typeof DOUBLE_QUOTE,
> = CSVSource extends `${infer A}${Quotation}${infer B}${Quotation}${infer C}`
  ? `${A}${B}${InferHeader<C, Quotation>}`
  : CSVSource extends `${infer A}${Newline}${string}`
    ? A
    : CSVSource;

/**
 * Generate a CSV header tuple from a CSVString.
 *
 * @category Types
 */
export type PickHeader<
  CSVSource extends CSVString,
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
> = CSVSource extends
  | `${infer Source}`
  // biome-ignore lint/suspicious/noRedeclare: <explanation>
  | ReadableStream<infer Source>
  ? readonly [...Split<InferHeader<Source, Quotation>, Delimiter>]
  : ReadonlyArray<string>;

/**
 * CSV String.
 *
 * @category Types
 */
export type CSVString<
  Header extends ReadonlyArray<string> = [],
  Delimiter extends string = typeof COMMA,
> = Header extends readonly [string, ...string[]]
  ?
      | `${Join<Header, Delimiter>}${typeof LF}${string}`
      | ReadableStream<`${Join<Header, Delimiter>}${typeof LF}${string}`>
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
  Delimiter extends string = typeof COMMA,
> = Header extends [] ? CSVString | CSVBinary : CSVString<Header, Delimiter>;
