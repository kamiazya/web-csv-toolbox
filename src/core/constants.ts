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
export const DEFAULT_ARRAY_BUFFER_THRESHOLD = 1 * 1024 * 1024; // 1MB

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
 * Maximum allowed field size limit in bytes.
 *
 * @remarks
 * This constant defines the absolute maximum field size that can be processed.
 * This limit is determined by the internal 30-bit offset representation used
 * in the Extended Scan format (bits 0-29 for offset, bit 30 for isQuoted, bit 31 for type).
 *
 * The value is 2^30 - 1 = 1,073,741,823 bytes ≈ 1GB.
 *
 * This limit cannot be exceeded even if the user requests a larger value via maxFieldSize.
 *
 * @category Constants
 */
export const MAX_FIELD_SIZE_LIMIT = 0x3fffffff; // 2^30 - 1 = 1,073,741,823 bytes ≈ 1GB

/**
 * Default maximum field size in bytes.
 *
 * @remarks
 * This constant defines the default maximum size for a single CSV field
 * to prevent memory exhaustion attacks from malformed or malicious CSV data.
 *
 * The default is set to 10MB, which covers 99.9% of legitimate use cases
 * while providing meaningful DoS protection. This value is also well under
 * the V8 string length limit (~512MB), ensuring consistent behavior across
 * all JavaScript runtimes.
 *
 * Users can increase this value up to MAX_FIELD_SIZE_LIMIT (1GB) if needed,
 * or decrease it for stricter security (e.g., 1MB for typical CSV data).
 *
 * @see {@link MAX_FIELD_SIZE_LIMIT} for the maximum allowed value
 * @see {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/length | MDN String.length} for runtime-specific string limits
 *
 * @category Constants
 */
export const DEFAULT_MAX_FIELD_SIZE = 10 * 1024 * 1024; // 10MB

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
 * Token type enumeration for CSV lexer.
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
