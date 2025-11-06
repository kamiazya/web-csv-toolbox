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
 * Default threshold (in bytes) for Blob reading strategy.
 *
 * Files smaller than this use `blob.arrayBuffer()` (faster),
 * files equal or larger use `blob.stream()` (memory-efficient).
 *
 * This value is determined by benchmarks.
 *
 * @category Constants
 */
export const DEFAULT_ARRAY_BUFFER_THRESHOLD = 1048576; // 1MB
export type DEFAULT_ARRAY_BUFFER_THRESHOLD =
  typeof DEFAULT_ARRAY_BUFFER_THRESHOLD;
