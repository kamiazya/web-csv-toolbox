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
 * This value is determined by benchmarks (Report 55).
 *
 * **Performance Characteristics:**
 * - `< 5MB`: arrayBuffer mode (~70 MB/s) - 20x faster than stream
 * - `≥ 5MB`: stream mode (~3 MB/s) - memory-safe for large files
 *
 * @see {@link https://github.com/kamiazya/web-csv-toolbox/blob/main/benchmark/reports/55-browser-performance/STREAM-UNIFIED-RESULTS.md}
 * @category Constants
 */
export const DEFAULT_ARRAY_BUFFER_THRESHOLD = 5 * 1024 * 1024; // 5MB

/**
 * Default maximum buffer size for CSV lexer in characters (UTF-16 code units).
 *
 * @remarks
 * This constant defines the maximum size of the internal buffer used by the CSV lexer
 * during tokenization. The buffer size is measured in UTF-16 code units (JavaScript string length).
 * Approximately 10MB for ASCII text, but may vary for non-ASCII characters.
 *
 * @category Constants
 */
export const DEFAULT_LEXER_MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * Default maximum field count per record for CSV record assembler.
 *
 * @remarks
 * This constant defines the maximum number of fields (columns) allowed in a single CSV record.
 * This limit helps prevent memory exhaustion attacks from malformed CSV data.
 *
 * @category Constants
 */
export const DEFAULT_ASSEMBLER_MAX_FIELD_COUNT = 100_000;

/**
 * Default maximum binary size in bytes for ArrayBuffer/Uint8Array inputs.
 *
 * @remarks
 * This constant defines the maximum size for binary data (ArrayBuffer or Uint8Array)
 * to prevent memory exhaustion attacks. Approximately 100MB.
 *
 * @category Constants
 */
export const DEFAULT_BINARY_MAX_SIZE = 100 * 1024 * 1024;

/**
 * Default backpressure check interval for stream transformers.
 *
 * @remarks
 * This constant defines how often stream transformers check for backpressure
 * (measured in number of items processed). The transformer yields to the event loop
 * when backpressure is detected to prevent blocking the main thread.
 *
 * Used by CSVLexerTransformer, StringCSVParserStream, and BinaryCSVParserStream.
 *
 * @category Constants
 */
export const DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL = 100;

/**
 * Default backpressure check interval for record assembler transformer.
 *
 * @remarks
 * This constant defines how often the record assembler transformer checks for backpressure
 * (measured in number of records processed). A lower value than general stream transformers
 * is used because record assembly is a more granular operation.
 *
 * Used by CSVRecordAssemblerTransformer.
 *
 * @category Constants
 */
export const DEFAULT_ASSEMBLER_BACKPRESSURE_CHECK_INTERVAL = 10;

/**
 * Delimiter type enumeration for unified token format.
 *
 * Used in the new FieldToken format to indicate what follows the field value.
 * This enables a more efficient token format where only field tokens are emitted.
 *
 * @category Constants
 */
export enum Delimiter {
  /** Next token is a field (followed by field delimiter like comma) */
  Field = 0,
  /** Next token is a record delimiter (newline) */
  Record = 1,
  // /** End of file/stream */
  // EOF = 2,
}

/**
 * Token type enumeration for CSV lexer (WASM-compatible).
 *
 * Uses numeric values for zero-overhead WASM interoperability.
 * Values must match the Rust enum in `web-csv-toolbox-wasm/src/lib.rs`.
 *
 * @category Constants
 */
export enum TokenType {
  /** Field token - represents a CSV field value */
  Field = 0,
  /** Field delimiter token - represents a comma or custom delimiter */
  FieldDelimiter = 1,
  /** Record delimiter token - represents a newline (CR, LF, or CRLF) */
  RecordDelimiter = 2,
}

/**
 * Field token type value.
 * @category Constants
 * @deprecated Use `TokenType.Field` instead. Will be removed in next major version.
 */
export const Field = TokenType.Field;

/**
 * FieldDelimiter token type value.
 * @category Constants
 * @deprecated Use `TokenType.FieldDelimiter` instead. Will be removed in next major version.
 */
export const FieldDelimiter = TokenType.FieldDelimiter;

/**
 * RecordDelimiter token type value.
 * @category Constants
 * @deprecated Use `TokenType.RecordDelimiter` instead. Will be removed in next major version.
 */
export const RecordDelimiter = TokenType.RecordDelimiter;
