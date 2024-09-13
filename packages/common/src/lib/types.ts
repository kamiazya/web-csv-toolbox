import type { BinaryOptions } from "@web-csv-toolbox/shared";
import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  Field,
  FieldDelimiter,
  Newline,
  RecordDelimiter,
} from "./constants.ts";

/**
 * Generate new string by concatenating all of the elements in array.
 *
 * @category Types
 *
 * @example Default
 *
 * ```ts
 * const header = ["name", "age", "city", "zip"];
 *
 * type _ = Join<typeof header>
 * // `name,age,city,zip`
 * ```
 *
 * @example With different delimiter and quotation
 *
 * ```ts
 * const header = ["name", "a\nge", "city", "zip"];
 *
 * type _ = Join<typeof header, "@", "$">
 * // `name@$a\nge$@city@zip`
 * ```
 */
export type Join<
  Chars extends ReadonlyArray<string | number | boolean | bigint>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Nl extends string = Exclude<Newline, Delimiter | Quotation>,
> = Chars extends readonly [infer F, ...infer R]
  ? F extends string
    ? R extends string[]
      ? `${F extends `${string}${Nl | Delimiter | Quotation}${string}`
          ? `${Quotation}${F}${Quotation}`
          : F}${R extends [] ? "" : Delimiter}${Join<R, Delimiter, Quotation>}`
      : string
    : string
  : "";

/**
 * Generate a delimiter-separated tuple from a string.
 *
 * @category Types
 *
 * @example Default
 *
 * ```ts
 * const header = `name,age,city,zip`;
 *
 * type _ = Split<typeof header>
 * // ["name", "age", "city", "zip"]
 * ```
 *
 * @example With different delimiter and quotation
 *
 * ```ts
 * const header = `name@$a
 * ge$@city@zip`;
 *
 * type _ = Split<typeof header, "@", "$">
 * // ["name", "a\nge", "city", "zip"]
 * ```
 */
export type Split<
  Char extends string,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Escaping extends boolean = false,
  Col extends string = "",
  Result extends string[] = [],
> = Char extends `${Delimiter}${infer R}`
  ? Escaping extends true
    ? Split<R, Delimiter, Quotation, true, `${Col}${Delimiter}`, Result>
    : Split<R, Delimiter, Quotation, false, "", [...Result, Col]>
  : Char extends `${Quotation}${infer R}`
    ? Escaping extends true
      ? R extends "" | Delimiter | `${Delimiter}${string}`
        ? Split<R, Delimiter, Quotation, false, Col, Result>
        : Split<R, Delimiter, Quotation, true, `${Col}${Quotation}`, Result>
      : Split<R, Delimiter, Quotation, true, Col, Result>
    : Char extends `${infer F}${infer R}`
      ? Split<R, Delimiter, Quotation, Escaping, `${Col}${F}`, Result>
      : [...Result, Col] extends [""]
        ? readonly string[]
        : readonly [...Result, Col];

type ExtractString<Source extends CSVString> = Source extends
  | `${infer S}`
  // biome-ignore lint/suspicious/noRedeclare: <explanation>
  | ReadableStream<infer S>
  ? S
  : string;

type ExtractCSVBody<
  CSVSource extends CSVString,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Nl extends string = Exclude<Newline, Delimiter | Quotation>,
  Escaping extends boolean = false,
> = ExtractString<CSVSource> extends `${Quotation}${infer R}`
  ? Escaping extends true
    ? R extends Delimiter | Nl | `${Delimiter | Nl}${string}`
      ? ExtractCSVBody<R, Delimiter, Quotation, Nl, false>
      : ExtractCSVBody<R, Delimiter, Quotation, Nl, true>
    : ExtractCSVBody<R, Delimiter, Quotation, Nl, true>
  : ExtractString<CSVSource> extends `${infer _ extends Nl}${infer R}`
    ? Escaping extends true
      ? ExtractCSVBody<R, Delimiter, Quotation, Nl, true>
      : R
    : ExtractString<CSVSource> extends `${infer _}${infer R}`
      ? ExtractCSVBody<R, Delimiter, Quotation, Nl, Escaping>
      : "";

/**
 * Extract a CSV header string from a CSVString.
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
 * type _ = ExtractCSVHeader<typeof csv>
 * // "name,age"
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
 * type _ = ExtractCSVHeader<typeof csv, "@", "$">
 * // "name@$a\nge$"
 * ```
 */
export type ExtractCSVHeader<
  CSVSource extends CSVString,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Nl extends string = Exclude<Newline, Delimiter | Quotation>,
  Escaping extends boolean = false,
> = ExtractString<CSVSource> extends `${infer Header}${Newline}${ExtractCSVBody<
  CSVSource,
  Delimiter,
  Quotation,
  Nl,
  Escaping
>}`
  ? Header
  : ExtractString<CSVSource>;

/**
 * Generates a delimiter-separated tuple of CSV headers from a CSVString.
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
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> = ExtractString<CSVSource> extends `${infer S}`
  ? Split<ExtractCSVHeader<S, Delimiter, Quotation>, Delimiter, Quotation>
  : ReadonlyArray<string>;

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
export interface RecordAssemblerOptions<Header extends ReadonlyArray<string>>
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
    RecordAssemblerOptions<Header>,
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
