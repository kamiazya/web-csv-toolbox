import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  Newline,
} from "../constants.ts";
import type { CSVString } from "../web-csv-toolbox.ts";

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
