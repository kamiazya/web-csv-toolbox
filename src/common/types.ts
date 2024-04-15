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
  delimiter?: string;
  /**
   * CSV field quotation.
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

type Concat<T extends any[]> = T extends [infer F, ...infer R]
  ? R extends any[]
    ? F & Concat<R>
    : F
  : // biome-ignore lint/complexity/noBannedTypes: <explanation>
    {};

type Replace<
  Target extends string,
  From extends string,
  To extends string,
> = Target extends `${infer A}${From}${infer B}`
  ? Replace<`${A}${To}${B}`, From, To>
  : Target;

type Split<
  Char extends string,
  Delimiter extends string = typeof COMMA,
> = Char extends `${infer F}${Delimiter}${infer R}`
  ? [F, ...Split<R, Delimiter>]
  : [Char];

type Join<
  Chars extends ReadonlyArray<string | number | boolean | bigint>,
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
> = Chars extends readonly [infer F, ...infer R]
  ? F extends string
    ? R extends string[]
      ? `${F extends `${string}${Newline}${string}`
          ? `${Quotation}${F}${Quotation}`
          : F}${R extends [] ? "" : Delimiter}${Join<R, Delimiter, Quotation>}`
      : string
    : string
  : "";

type Newline = typeof CR | typeof CRLF | typeof LF;
type DummyNewline<NL extends Newline> =
  `web-csv-toolbox.DummyNewline-${NL extends typeof CRLF
    ? "crlf"
    : NL extends typeof CR
      ? "cr"
      : "lf"}`;

type SplitNewline<T extends string> =
  T extends `${infer A}${typeof CRLF}${infer B}`
    ? [...Split<A, typeof CRLF>, ...SplitNewline<B>]
    : T extends `${infer A}${typeof CR}${infer B}`
      ? [...Split<A, typeof CR>, ...SplitNewline<B>]
      : T extends `${infer A}${typeof LF}${infer B}`
        ? [...Split<A, typeof LF>, ...SplitNewline<B>]
        : [T];

type Newline2DummyNewline<T extends string> =
  T extends `${infer A}${typeof CRLF}${infer B}`
    ? Newline2DummyNewline<`${A}${DummyNewline<typeof CRLF>}${B}`>
    : T extends `${infer A}${typeof CR}${infer B}`
      ? Newline2DummyNewline<`${A}${DummyNewline<typeof CR>}${B}`>
      : T extends `${infer A}${typeof LF}${infer B}`
        ? Newline2DummyNewline<`${A}${DummyNewline<typeof LF>}${B}`>
        : T;

type DummyNewline2Newline<T extends string> =
  T extends `${infer A}${DummyNewline<typeof CRLF>}${infer B}`
    ? DummyNewline2Newline<`${A}${typeof CRLF}${B}`>
    : T extends `${infer A}${DummyNewline<typeof CR>}${infer B}`
      ? DummyNewline2Newline<`${A}${typeof CR}${B}`>
      : T extends `${infer A}${DummyNewline<typeof LF>}${infer B}`
        ? DummyNewline2Newline<`${A}${typeof LF}${B}`>
        : T;

type EscapeInnerNewline<
  CSVSource extends string,
  Quotation extends string = typeof DOUBLE_QUOTE,
> = CSVSource extends `${infer A}${Quotation}${infer B}${Quotation}${infer C}`
  ? `${A}${Newline2DummyNewline<B>}${EscapeInnerNewline<C, Quotation>}`
  : CSVSource;

type Row2Record<H extends PropertyKey[], V extends any[][]> = {
  [K in keyof V]: Concat<{
    [P in keyof H]: { [Key in H[P]]: V[K][Extract<keyof V[K], P>] };
  }>;
};

type ToCSVRows<
  T extends string,
  Quotation extends string = typeof DOUBLE_QUOTE,
> = SplitNewline<EscapeInnerNewline<T, Quotation>> extends infer R
  ? {
      [K in keyof R]: R[K] extends string ? DummyNewline2Newline<R[K]> : never;
    }
  : ReadonlyArray<string>;

/**
 * Generate a CSV header tuple from a CSVString.
 *
 * @category Types
 *
 * @example Default
 *
 * ```ts
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * type _ = ToParsedCSVRecords<typeof csv>
 * // [
 * //   { name: "Alice"; age: "42"; },
 * //   { name: "Bob"; age: "69" }
 * // ]
 *```
 *
 * @example With different delimiter and quotation
 *
 * ```ts
 * const csv = `name@$a
 * ge$
 * $Ali
 * ce$@42
 * Bob@69`;
 *
 * type _ = ToParsedCSVRecords<typeof csv, "@", "$">
 * // [
 * //   { name: "Ali\nce"; "a\nge": "42"; },
 * //   { name: "Bob"; "a\nge": "69" }
 * // ]
 * ```
 */
export type ToParsedCSVRecords<
  T extends string,
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
> = ToCSVRows<T, Quotation> extends [infer H extends string, ...infer R]
  ? R extends [string, ...string[]]
    ? Row2Record<
        Split<H, Delimiter> extends PropertyKey[]
          ? Split<H, Delimiter>
          : PropertyKey[],
        {
          [K in keyof R]: Split<R[K], Delimiter>;
        }
      >
    : CSVRecord<Split<H, Delimiter>>
  : CSVRecord<readonly string[]>;

/**
 * Generate a CSV header tuple from a CSVString.
 *
 * @category Types
 *
 * @example Default
 *
 * ```ts
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * type _ = PickCSVHeader<typeof csv>
 * // ["name", "age"]
 * ```
 *
 * @example With different delimiter and quotation
 *
 * ```ts
 * const csv = `name@$a
 * ge$
 * $Ali
 * ce$@42
 * Bob@69`;
 *
 * type _ = PickCSVHeader<typeof csv, "@", "$">
 * // ["name", "a\nge"]
 * ```
 */
export type PickCSVHeader<
  CSVSource extends CSVString,
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
> = CSVSource extends
  | `${infer Source}`
  // biome-ignore lint/suspicious/noRedeclare: <explanation>
  | ReadableStream<infer Source>
  ? ToCSVRows<Source, Quotation> extends [
      infer Header extends string,
      ...string[],
    ]
    ? Split<Header, Delimiter>
    : []
  : ReadonlyArray<string>;

/**
 * CSV String.
 *
 * @category Types
 */
export type CSVString<
  Header extends ReadonlyArray<string> = [],
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
> = Header extends readonly [string, ...string[]]
  ?
      | `${Join<Header, Delimiter, Quotation>}${typeof LF}${string}`
      | ReadableStream<`${Join<
          Header,
          Delimiter,
          Quotation
        >}${typeof LF}${string}`>
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
  Quotation extends string = typeof DOUBLE_QUOTE,
> = Header extends []
  ? CSVString | CSVBinary
  : CSVString<Header, Delimiter, Quotation>;
