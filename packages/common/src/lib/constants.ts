export const CR = "\r";
export type CR = typeof CR;

export const CRLF = "\r\n";
export type CRLF = typeof CRLF;

export const LF = "\n";
export type LF = typeof LF;

export type Newline = CRLF | CR | LF;

/**
 * COMMA is a symbol for comma(,).
 */
export const COMMA = ",";

/**
 * DOUBLE_QUOTE is a symbol for double quote(").
 */
export const DOUBLE_QUOTE = '"';

export const DEFAULT_DELIMITER = COMMA;
export type DEFAULT_DELIMITER = typeof DEFAULT_DELIMITER;

export const DEFAULT_QUOTATION = DOUBLE_QUOTE;
export type DEFAULT_QUOTATION = typeof DEFAULT_QUOTATION;

/**
 * FiledDelimiter is a symbol for field delimiter of CSV.
 * @category Constants
 */
export const FieldDelimiter = Symbol.for("web-csv-toolbox.FieldDelimiter");
/**
 * RecordDelimiter is a symbol for record delimiter of CSV.
 * @category Constants
 */
export const RecordDelimiter = Symbol.for("web-csv-toolbox.RecordDelimiter");
/**
 * Field is a symbol for field of CSV.
 * @category Constants
 */
export const Field = Symbol.for("web-csv-toolbox.Field");
