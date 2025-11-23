import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  Field,
  FieldDelimiter,
  Newline,
  RecordDelimiter,
} from "@/core/constants.ts";

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
   * Row number in the CSV (includes header if present).
   * Starts from 1.
   *
   * @remarks
   * This represents the logical CSV row number, not the physical line number.
   * A single CSV row may span multiple lines if fields contain newline
   * characters within quotes.
   *
   * **Important distinction**:
   * - `line`: Physical line number (incremented by `\n` characters)
   * - `rowNumber`: Logical CSV row (incremented by record delimiters)
   *
   * The header row (if present) is counted as row 1. This corresponds to
   * the physical row position in the file, making it easy to locate in editors.
   *
   * For physical line numbers, use `start.line` or `end.line`.
   *
   * **Primary use case**: Error reporting. This field allows errors to be
   * reported with both physical position (`line`, `column`) and logical
   * row context (`rowNumber`), making it easier for users to locate
   * issues in their CSV data.
   *
   * @example
   * ```csv
   * name,description       <- rowNumber: 1 (header)
   * Alice,"Lives in
   * New York"              <- rowNumber: 2 (spans line 2-3)
   * Bob,"Works"            <- rowNumber: 3 (line 4)
   * ```
   * - Header: `rowNumber: 1`
   * - Alice's row: `start.line: 2, end.line: 3, rowNumber: 2`
   * - Bob's row: `start.line: 4, end.line: 4, rowNumber: 3`
   *
   * @example Error reporting
   * ```ts
   * try {
   *   await parseString(csv);
   * } catch (error) {
   *   if (error instanceof ParseError) {
   *     console.error(`Error at row ${error.rowNumber}, line ${error.position?.line}`);
   *   }
   * }
   * ```
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
 * Source identifier option for error reporting.
 * @category Types
 */
export interface SourceOption {
  /**
   * Source identifier for error reporting (e.g., filename, description).
   *
   * @remarks
   * This option allows you to specify a human-readable identifier for the CSV source
   * that will be included in error messages. This is particularly useful when parsing
   * multiple files or streams to help identify which source caused an error.
   *
   * **Security Note**: Do not include sensitive information (API keys, tokens, full URLs)
   * in this field as it may be exposed in error messages and logs.
   *
   * @example
   * ```ts
   * parseString(csv, { source: "users.csv" });
   * // Error: Field count exceeded at row 5 in "users.csv"
   * ```
   *
   * @default undefined
   */
  source?: string;
}

/**
 * Backpressure control options for streaming operations.
 * @category Types
 */
export interface BackpressureOptions {
  /**
   * Interval (in items) to check for backpressure.
   *
   * @remarks
   * Lower values = more responsive to backpressure but slight performance overhead.
   * Higher values = less overhead but slower backpressure response.
   *
   * The default value varies by implementation:
   * - Lexer/Parser streams: 100 (per 100 tokens/records)
   * - Assembler streams: 10 (per 10 records)
   *
   * @default varies by implementation
   */
  backpressureCheckInterval?: number;
}

/**
 * CSV Common Options.
 * @category Types
 */
export interface CommonOptions<
  Delimiter extends string,
  Quotation extends string,
> extends SourceOption {
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
  decompression?: CompressionFormat | undefined;
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
  charset?: string | undefined;
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
  maxBinarySize?: number | undefined;
  /**
   * If the binary has a BOM, you can specify whether to ignore it.
   *
   * @remarks
   * If you specify true, the BOM will be ignored.
   * If you specify false or not specify it, the BOM will be treated as a normal character.
   * See {@link https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/ignoreBOM | TextDecoderOptions.ignoreBOM} for more information about the BOM.
   * @default false
   */
  ignoreBOM?: boolean | undefined;
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
  fatal?: boolean | undefined;
  /**
   * Allow experimental or non-standard compression formats not explicitly supported by this library.
   *
   * @remarks
   * When `true`, compression formats from Content-Encoding headers that are not in the
   * default supported list will be passed to the runtime's DecompressionStream without
   * validation. This allows using compression formats that may not be universally supported
   * across all browsers.
   *
   * ### Default Supported Formats (cross-browser compatible)
   *
   * When `false` (default), only universally supported formats are allowed:
   * - **Node.js**: `gzip`, `deflate`, `br` (Brotli)
   * - **Browsers**: `gzip`, `deflate`
   *
   * ### Experimental Formats (require this flag)
   *
   * Some compression formats are only supported in specific environments:
   * - **`deflate-raw`**: Supported in Chromium-based browsers (Chrome, Edge) but may not work
   *   in Firefox or Safari
   * - **`br` (Brotli)**: Future browser support may vary
   * - Other formats: Depends on runtime implementation
   *
   * ### Browser Compatibility Notes
   *
   * If you enable this option and use `deflate-raw`:
   * - ✅ Works in Chrome, Edge (Chromium-based)
   * - ❌ May fail in Firefox, Safari
   * - Consider implementing fallback logic or detecting browser support at runtime
   *
   * **Use with caution**: Enabling this bypasses library validation and relies entirely
   * on runtime error handling. If the runtime doesn't support the format, you'll get
   * a runtime error instead of a clear validation error from this library.
   *
   * @default false
   *
   * @example
   * ```ts
   * // Safe mode (default): Only universally supported formats
   * const response = await fetch('data.csv.gz');
   * await parse(response); // ✓ Works in all browsers
   *
   * // Experimental mode: Allow deflate-raw (Chromium-only)
   * const response = await fetch('data.csv'); // Content-Encoding: deflate-raw
   * await parse(response, { allowExperimentalCompressions: true });
   * // ✓ Works in Chrome/Edge
   * // ✗ May fail in Firefox/Safari
   *
   * // Browser-aware usage
   * const isChromium = navigator.userAgent.includes('Chrome');
   * await parse(response, {
   *   allowExperimentalCompressions: isChromium
   * });
   * ```
   */
  allowExperimentalCompressions?: boolean | undefined;
  /**
   * Allow non-standard character encodings not in the common charset list.
   *
   * @remarks
   * When `true`, charset values from Content-Type headers that are not in the
   * default supported list will be passed to the runtime's TextDecoder without
   * validation. This allows using character encodings that may not be universally
   * supported across all environments.
   *
   * ### Default Supported Charsets (commonly used)
   *
   * When `false` (default), only commonly used charsets are allowed, including:
   * - **UTF**: `utf-8`, `utf-16le`, `utf-16be`
   * - **ISO-8859**: `iso-8859-1` through `iso-8859-16`
   * - **Windows**: `windows-1250` through `windows-1258`
   * - **Asian**: `shift_jis`, `euc-jp`, `gb18030`, `euc-kr`, etc.
   *
   * ### Security Considerations
   *
   * **Use with caution**: Enabling this bypasses library validation and relies entirely
   * on runtime error handling. Invalid or malicious charset values could cause:
   * - Runtime exceptions from TextDecoder
   * - Unexpected character decoding behavior
   * - Potential security vulnerabilities
   *
   * It's recommended to validate charset values against your expected inputs before
   * enabling this option.
   *
   * @default false
   *
   * @example
   * ```ts
   * // Safe mode (default): Only commonly supported charsets
   * const response = await fetch('data.csv');
   * await parse(response); // charset must be in SUPPORTED_CHARSETS
   *
   * // Allow non-standard charset
   * const response = await fetch('data.csv'); // Content-Type: text/csv; charset=custom-encoding
   * await parse(response, { allowNonStandardCharsets: true });
   * // ⚠️ May throw error if runtime doesn't support the charset
   * ```
   */
  allowNonStandardCharsets?: boolean | undefined;
}

/**
 * CSV Lexer Transformer Options.
 * @category Types
 */
export interface CSVLexerTransformerOptions<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends CommonOptions<Delimiter, Quotation>,
    AbortSignalOptions {}

/**
 * CSV Lexer Transformer Stream Options.
 * Options for CSVLexerTransformer stream behavior.
 * @category Types
 */
export interface CSVLexerTransformerStreamOptions extends BackpressureOptions {
  /**
   * @default 100
   */
  backpressureCheckInterval?: number;
}

/**
 * Base options shared by all CSV Record Assembler configurations.
 * @category Types
 */
type CSVRecordAssemblerBaseOptions = SourceOption &
  AbortSignalOptions & {
    /**
     * Maximum number of fields allowed in a single record.
     *
     * @default 100000
     */
    maxFieldCount?: number;

    /**
     * Skip empty lines during parsing.
     *
     * @default false
     */
    skipEmptyLines?: boolean;
  };

/**
 * Common interface for CSV Record Assembler options (without type constraints).
 * Use this when you need to extend CSV assembler options in other interfaces.
 * For type-safe options with compile-time validation, use CSVRecordAssemblerOptions.
 * @category Types
 */
export interface CSVRecordAssemblerCommonOptions<
  Header extends ReadonlyArray<string>,
> extends SourceOption,
    AbortSignalOptions {
  header?: Header;
  outputFormat?: "object" | "array";
  includeHeader?: boolean;
  columnCountStrategy?: ColumnCountStrategy;
  maxFieldCount?: number;
  skipEmptyLines?: boolean;
}

/**
 * CSV Record Assembler Options with type-level constraints.
 * @category Types
 *
 * @remarks
 * This type uses conditional types to enforce the following constraints at compile-time:
 *
 * **Headerless Mode (`header: []`)**:
 * - Requires `outputFormat: 'array'`
 * - Only allows `columnCountStrategy: 'keep'` (or omit for default)
 * - All rows are treated as data (no header inference)
 *
 * **Normal Mode (header inferred or explicit)**:
 * - `header: undefined` → infer from first row
 * - `header: ['col1', ...]` → explicit header
 * - Allows any `outputFormat` and `columnCountStrategy`
 *
 * @example Type-safe headerless mode
 * ```ts
 * // ✓ Valid: headerless with array format
 * const opts1: CSVRecordAssemblerOptions<readonly []> = {
 *   header: [],
 *   outputFormat: 'array',
 *   columnCountStrategy: 'keep'
 * };
 *
 * // ✗ Type error: headerless requires array format
 * const opts2: CSVRecordAssemblerOptions<readonly []> = {
 *   header: [],
 *   outputFormat: 'object' // Error!
 * };
 *
 * // ✗ Type error: headerless only allows 'keep' strategy
 * const opts3: CSVRecordAssemblerOptions<readonly []> = {
 *   header: [],
 *   outputFormat: 'array',
 *   columnCountStrategy: 'strict' // Error!
 * };
 * ```
 */
export type CSVRecordAssemblerOptions<Header extends ReadonlyArray<string>> =
  Header extends readonly []
    ? // Headerless mode: strict constraints
      CSVRecordAssemblerBaseOptions & {
        /**
         * CSV header specification.
         * For headerless mode, must be an empty array.
         */
        header: readonly [];

        /**
         * Output format for CSV records.
         * Headerless mode requires array format.
         */
        outputFormat: "array";

        /**
         * Strategy for handling column count mismatches.
         * Headerless mode only supports 'keep' strategy.
         *
         * @default 'keep'
         */
        columnCountStrategy?: "keep";

        /**
         * Include header row as the first element in array output.
         * Not applicable in headerless mode (no header to include).
         *
         * @default false
         */
        includeHeader?: boolean;
      }
    : // Normal mode: flexible configuration
      CSVRecordAssemblerBaseOptions & {
        /**
         * CSV header specification.
         *
         * @remarks
         * **Behavior by value**:
         * - `undefined` (default): First row is automatically inferred as the header
         * - `['col1', 'col2', ...]`: Explicit header, first row is treated as data
         *
         * @default undefined (infer from first row)
         *
         * @example
         * ```ts
         * // Infer header from first row
         * const records = parseStringToArraySync('name,age\nAlice,30', {
         *   // header: undefined (default)
         * });
         * // => [{ name: 'Alice', age: '30' }]
         *
         * // Explicit header
         * const records = parseStringToArraySync('Alice,30\nBob,25', {
         *   header: ['name', 'age']
         * });
         * // => [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
         * ```
         */
        header?: Header;

        /**
         * Output format for CSV records.
         *
         * @remarks
         * - `'object'` (default): Records are returned as objects with header keys
         * - `'array'`: Records are returned as readonly arrays (named tuples when header is provided)
         *
         * @default 'object'
         *
         * @example
         * ```ts
         * // With 'object' format (default)
         * { name: 'Alice', age: '30' }
         *
         * // With 'array' format
         * ['Alice', '30'] // Type: readonly [name: string, age: string]
         * ```
         */
        outputFormat?: "object" | "array";

        /**
         * Include header row as the first element in array output.
         *
         * @remarks
         * Only valid when `outputFormat` is `'array'`.
         * When true, the header array will be yielded as the first record.
         *
         * @default false
         *
         * @throws {Error} If used with `outputFormat: 'object'`
         *
         * @example
         * ```ts
         * // With includeHeader: true and header: ['name', 'age']
         * // First record: ['name', 'age']
         * // Second record: ['Alice', '30']
         * ```
         */
        includeHeader?: boolean;

        /**
         * Strategy for handling column count mismatches between header and data rows.
         *
         * @remarks
         * Controls how to handle rows with column counts different from the header.
         * See {@link ColumnCountStrategy} for detailed strategy descriptions.
         *
         * **Strategy overview**:
         * - `'keep'`: Keep rows as-is (array format varies length; object format acts like `'pad'`)
         * - `'pad'`: Pad short rows with undefined, truncate long rows
         * - `'strict'`: Throw error on length mismatch
         * - `'truncate'`: Truncate long rows, keep short rows as-is (object format: all keys present)
         *
         * **Headerless CSV**:
         * When `header` is undefined or `[]`, this option is accepted but behaves as `'keep'`.
         * For explicit headerless mode (`header: []`), only `'keep'` is allowed at runtime.
         *
         * @default 'keep' for array format, 'pad' for object format
         *
         * @example Array format examples
         * ```ts
         * // Header: ['name', 'age', 'city']
         * // Row: 'Alice,30'
         * // outputFormat: 'array'
         *
         * // columnCountStrategy: 'keep' → ['Alice', '30'] (short row kept)
         * // columnCountStrategy: 'pad' → ['Alice', '30', undefined] (padded)
         * // columnCountStrategy: 'strict' → Error thrown
         * // columnCountStrategy: 'truncate' → ['Alice', '30'] (short row kept)
         * ```
         *
         * @example Object format examples
         * ```ts
         * // Header: ['name', 'age', 'city']
         * // Row: 'Alice,30'
         * // outputFormat: 'object'
         *
         * // columnCountStrategy: 'keep' → { name: 'Alice', age: '30', city: undefined } (treated as 'pad')
         * // columnCountStrategy: 'pad' → { name: 'Alice', age: '30', city: undefined } (all keys)
         * // columnCountStrategy: 'strict' → Error thrown
         * // columnCountStrategy: 'truncate' → { name: 'Alice', age: '30', city: undefined } (all keys)
         * ```
         */
        columnCountStrategy?: ColumnCountStrategy;
      };

/**
 * CSV Record Assembler Transformer Stream Options.
 * Options for CSVRecordAssemblerTransformer stream behavior.
 * @category Types
 */
export interface CSVRecordAssemblerTransformerStreamOptions
  extends BackpressureOptions {
  /**
   * @default 10
   */
  backpressureCheckInterval?: number;
}

/**
 * Options for BinaryCSVParserStream.
 * @category Types
 */
export interface BinaryCSVParserStreamOptions extends BackpressureOptions {
  /**
   * @default 100
   */
  backpressureCheckInterval?: number;
}

/**
 * Options for StringCSVParserStream.
 * @category Types
 */
export interface StringCSVParserStreamOptions extends BackpressureOptions {
  /**
   * @default 100
   */
  backpressureCheckInterval?: number;
}

/**
 * Worker communication strategy.
 *
 * Defines how data is communicated between the main thread and worker threads.
 *
 * @category Types
 */
export type WorkerCommunicationStrategy =
  | "message-streaming"
  | "stream-transfer";

/**
 * Engine fallback information.
 *
 * Provided when the requested engine configuration fails and falls back to a safer configuration.
 *
 * @category Types
 */
export interface EngineFallbackInfo {
  /**
   * Original requested configuration.
   */
  requestedConfig: EngineConfig;

  /**
   * Actual configuration after fallback.
   */
  actualConfig: EngineConfig;

  /**
   * Reason for fallback.
   */
  reason: string;

  /**
   * Original error if any.
   */
  error?: Error | undefined;
}

/**
 * Backpressure monitoring intervals (count-based).
 *
 * Controls how frequently the internal parsers check for backpressure
 * during streaming operations, based on the number of tokens/records processed.
 *
 * @experimental This API may change in future versions based on performance research.
 * @category Types
 */
export interface BackpressureCheckInterval {
  /**
   * Check interval for the lexer stage (number of tokens processed).
   *
   * Lower values provide better responsiveness to backpressure but may have
   * slight performance overhead.
   *
   * @default 100
   */
  lexer?: number;

  /**
   * Check interval for the assembler stage (number of records processed).
   *
   * Lower values provide better responsiveness to backpressure but may have
   * slight performance overhead.
   *
   * @default 10
   */
  assembler?: number;
}

/**
 * Internal streaming queuing strategies configuration.
 *
 * Controls the internal queuing behavior of the CSV parser's streaming pipeline.
 * This affects memory usage and backpressure handling for large streaming operations.
 *
 * @remarks
 * The CSV parser uses a two-stage pipeline:
 * 1. **Lexer**: String → Token
 * 2. **Assembler**: Token → CSVRecord
 *
 * Each stage has both writable (input) and readable (output) sides.
 *
 * @experimental This API may change in future versions based on performance research.
 * @category Types
 */
export interface QueuingStrategyConfig {
  /**
   * Queuing strategy for the lexer's writable side (string input).
   *
   * Controls how string chunks are buffered before being processed by the lexer.
   *
   * @default `{ highWaterMark: 65536 }` (≈64KB of characters)
   */
  lexerWritable?: QueuingStrategy<string>;

  /**
   * Queuing strategy for the lexer's readable side (token output).
   *
   * Controls how tokens are buffered after being produced by the lexer
   * before being consumed by the assembler.
   *
   * @default `{ highWaterMark: 1024 }` (1024 tokens)
   */
  lexerReadable?: QueuingStrategy<Token>;

  /**
   * Queuing strategy for the assembler's writable side (token input).
   *
   * Controls how tokens are buffered before being processed by the assembler.
   * This is the input side of the assembler, receiving tokens from the lexer.
   *
   * @default `{ highWaterMark: 1024 }` (1024 tokens)
   */
  assemblerWritable?: QueuingStrategy<Token>;

  /**
   * Queuing strategy for the assembler's readable side (record output).
   *
   * Controls how CSV records are buffered after being assembled.
   *
   * @default `{ highWaterMark: 256 }` (256 records)
   */
  assemblerReadable?: QueuingStrategy<CSVRecord<any>>;
}

/**
 * Base engine configuration shared by all execution modes.
 *
 * @category Types
 */
interface BaseEngineConfig {
  /**
   * Use WASM implementation.
   *
   * WASM module is automatically initialized on first use.
   * However, it is recommended to call {@link loadWASM} beforehand for better performance.
   *
   * @default false
   *
   * @example Main thread + WASM
   * ```ts
   * import { loadWASM, parse } from 'web-csv-toolbox';
   *
   * await loadWASM();
   * parse(csv, { engine: { wasm: true } })
   * ```
   *
   * @example Worker + WASM
   * ```ts
   * import { loadWASM, parse } from 'web-csv-toolbox';
   *
   * await loadWASM();
   * parse(csv, { engine: { worker: true, wasm: true } })
   * ```
   */
  wasm?: boolean | undefined;

  /**
   * Blob reading strategy threshold (in bytes).
   * Only applicable for `parseBlob()` and `parseFile()`.
   *
   * Determines when to use `blob.arrayBuffer()` vs `blob.stream()`:
   * - Files smaller than threshold: Use `blob.arrayBuffer()` + `parseBinary()`
   *   - ✅ Faster for small files
   *   - ❌ Loads entire file into memory
   * - Files equal to or larger than threshold: Use `blob.stream()` + `parseBinaryStream()`
   *   - ✅ Memory-efficient for large files
   *   - ❌ Slight streaming overhead
   *
   * @default 1_048_576 (1MB)
   */
  arrayBufferThreshold?: number | undefined;

  /**
   * Backpressure monitoring intervals (count-based: number of tokens/records processed).
   *
   * @default { lexer: 100, assembler: 10 }
   * @experimental
   */
  backpressureCheckInterval?: BackpressureCheckInterval | undefined;

  /**
   * Internal streaming queuing strategies.
   *
   * @experimental
   */
  queuingStrategy?: QueuingStrategyConfig | undefined;
}

/**
 * Engine configuration for main thread execution.
 *
 * @category Types
 */
export interface MainThreadEngineConfig extends BaseEngineConfig {
  /**
   * Execute in Worker thread.
   *
   * @default false
   */
  worker?: false;
}

/**
 * Engine configuration for worker thread execution.
 *
 * @category Types
 */
export interface WorkerEngineConfig extends BaseEngineConfig {
  /**
   * Execute in Worker thread.
   */
  worker: true;

  /**
   * Custom Worker URL.
   *
   * If not provided, uses the bundled worker.
   *
   * @remarks
   * The custom worker must implement the same message protocol as the bundled worker.
   *
   * @example Custom worker
   * ```ts
   * parse(csv, {
   *   engine: {
   *     worker: true,
   *     workerURL: new URL('./custom-worker.js', import.meta.url)
   *   }
   * })
   * ```
   */
  workerURL?: string | URL | undefined;

  /**
   * Worker pool for managing worker lifecycle.
   *
   * When provided, the parsing function will use this pool's worker instance
   * instead of creating/reusing a module-level singleton worker.
   *
   * Use {@link WorkerPool} with the `using` syntax for automatic cleanup.
   *
   * @example Using ReusableWorkerPool with automatic cleanup
   * ```ts
   * import { ReusableWorkerPool, parseString } from 'web-csv-toolbox';
   *
   * async function processCSV(csv: string) {
   *   using pool = new ReusableWorkerPool();
   *
   *   const records = [];
   *   for await (const record of parseString(csv, {
   *     engine: { worker: true, workerPool: pool }
   *   })) {
   *     records.push(record);
   *   }
   *
   *   return records;
   *   // Worker is automatically terminated when leaving this scope
   * }
   * ```
   *
   * @example Multiple operations with same pool
   * ```ts
   * import { ReusableWorkerPool, parseString } from 'web-csv-toolbox';
   *
   * using pool = new ReusableWorkerPool();
   *
   * await parseString(csv1, { engine: { worker: true, workerPool: pool } });
   * await parseString(csv2, { engine: { worker: true, workerPool: pool } });
   * // Worker is reused for both operations
   * ```
   */
  workerPool?: WorkerPool | undefined;

  /**
   * Worker communication strategy.
   *
   * - `"message-streaming"` (default): Message-based streaming
   *   - ✅ All browsers including Safari
   *   - ✅ Stable and reliable
   *   - Records are sent one-by-one via postMessage
   *
   * - `"stream-transfer"`: TransferableStreams
   *   - ✅ Chrome 87+, Firefox 103+, Edge 87+
   *   - ❌ Safari (not supported, will fallback unless strict mode)
   *   - ⚡ Zero-copy transfer, more efficient
   *   - Uses ReadableStream transfer
   *
   * @default "message-streaming"
   *
   * @see https://caniuse.com/mdn-api_readablestream_transferable
   *
   * @example Message streaming (default, safe)
   * ```ts
   * parse(csv, { engine: { worker: true } })
   * // or explicitly
   * parse(csv, { engine: { worker: true, workerStrategy: "message-streaming" } })
   * ```
   *
   * @example Stream transfer (Chrome/Firefox/Edge, auto-fallback on Safari)
   * ```ts
   * parse(csv, {
   *   engine: {
   *     worker: true,
   *     workerStrategy: "stream-transfer",
   *     onFallback: (info) => {
   *       console.warn(`Fallback to message-streaming: ${info.reason}`);
   *     }
   *   }
   * })
   * ```
   */
  workerStrategy?: WorkerCommunicationStrategy | undefined;

  /**
   * Strict mode: disable automatic fallback.
   *
   * When enabled:
   * - Throws error immediately if stream transfer fails
   * - Does not fallback to message-streaming
   * - `onFallback` is never called
   *
   * When disabled (default):
   * - Automatically falls back to message-streaming on failure
   * - Calls `onFallback` if provided
   *
   * @default false
   *
   * @example Strict mode (Chrome/Firefox/Edge only)
   * ```ts
   * try {
   *   parse(csv, {
   *     engine: {
   *       worker: true,
   *       workerStrategy: "stream-transfer",
   *       strict: true
   *     }
   *   })
   * } catch (error) {
   *   // Safari will throw error here
   *   console.error('Stream transfer not supported:', error);
   * }
   * ```
   */
  strict?: boolean | undefined;

  /**
   * Callback when engine configuration fallback occurs.
   *
   * Called when the requested configuration fails and falls back to a safer configuration.
   * Not called if `strict: true` (throws error instead).
   *
   * Common fallback scenario:
   * - `workerStrategy: "stream-transfer"` → `"message-streaming"` (Safari)
   *
   * @example Track fallback in analytics
   * ```ts
   * parse(csv, {
   *   engine: {
   *     worker: true,
   *     workerStrategy: "stream-transfer",
   *     onFallback: (info) => {
   *       console.warn(`Fallback occurred: ${info.reason}`);
   *       analytics.track('engine-fallback', {
   *         reason: info.reason,
   *         userAgent: navigator.userAgent
   *       });
   *     }
   *   }
   * })
   * ```
   */
  onFallback?: ((info: EngineFallbackInfo) => void) | undefined;
}

/**
 * Common interface for worker pools.
 * Both ReusableWorkerPool and TransientWorkerPool implement this interface.
 *
 * @remarks
 * This interface defines the contract for worker pool implementations.
 * Users typically use {@link ReusableWorkerPool} for persistent worker pools,
 * while the internal default pool uses {@link TransientWorkerPool} for automatic cleanup.
 *
 * @category Types
 */
export interface WorkerPool {
  /**
   * Get a worker instance from the pool.
   *
   * @param workerURL - Optional custom worker URL
   * @returns A worker instance
   */
  getWorker(workerURL?: string | URL): Promise<Worker>;

  /**
   * Get the next request ID for this pool.
   *
   * @returns The next request ID
   */
  getNextRequestId(): number;

  /**
   * Release a worker back to the pool.
   *
   * @param worker - The worker to release
   */
  releaseWorker(worker: Worker): void;

  /**
   * Get the current number of workers in the pool.
   *
   * @returns The number of active workers
   */
  readonly size: number;

  /**
   * Check if the pool has reached its maximum capacity.
   *
   * @returns True if the pool is at maximum capacity, false otherwise
   */
  isFull(): boolean;

  /**
   * Terminate all workers in the pool and clean up resources.
   */
  terminate(): void;

  /**
   * Dispose of the worker pool, terminating all workers.
   */
  [Symbol.dispose](): void;
}

/**
 * Engine configuration for CSV parsing.
 *
 * All parsing engine settings are unified in this type.
 * Use discriminated union to ensure type-safe configuration based on worker mode.
 *
 * @category Types
 */
export type EngineConfig = MainThreadEngineConfig | WorkerEngineConfig;

/**
 * Engine configuration options.
 *
 * @category Types
 */
export interface EngineOptions {
  /**
   * Engine configuration for CSV parsing.
   *
   * @example Default (main thread)
   * ```ts
   * parse(csv)
   * ```
   *
   * @example Worker
   * ```ts
   * parse(csv, { engine: { worker: true } })
   * ```
   *
   * @example Worker + WASM
   * ```ts
   * await loadWASM();
   * parse(csv, { engine: { worker: true, wasm: true } })
   * ```
   *
   * @example Worker + Stream transfer
   * ```ts
   * parse(csv, {
   *   engine: {
   *     worker: true,
   *     workerStrategy: "stream-transfer"
   *   }
   * })
   * ```
   */
  engine?: EngineConfig;
}

/**
 * Helper type to infer the output format from ParseOptions.
 *
 * @category Types
 *
 * @remarks
 * This type extracts the output format from options and defaults to 'object' if not specified.
 */
export type InferFormat<Options> = Options extends { outputFormat: infer F }
  ? F extends "object" | "array"
    ? F
    : "object"
  : "object";

/**
 * Helper type to infer the column count strategy from ParseOptions.
 *
 * @category Types
 *
 * @remarks
 * This type extracts the columnCountStrategy from options and defaults to 'keep' if not specified.
 */
export type InferStrategy<Options> = Options extends {
  columnCountStrategy: infer S;
}
  ? S extends ColumnCountStrategy
    ? S
    : "keep"
  : "keep";

/**
 * Helper type to get the CSV record type based on header and options.
 *
 * @category Types
 *
 * @remarks
 * This type determines the CSVRecord type based on the header, output format, and columnCountStrategy in options.
 * For array format with 'pad' strategy, fields are typed as `string | undefined`.
 */
export type InferCSVRecord<
  Header extends ReadonlyArray<string>,
  Options = Record<string, never>,
> = CSVRecord<Header, InferFormat<Options>, InferStrategy<Options>>;

/**
 * Parse options for CSV string.
 * @category Types
 */
export interface ParseOptions<
  Header extends ReadonlyArray<string> = ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends CommonOptions<Delimiter, Quotation>,
    CSVRecordAssemblerCommonOptions<Header>,
    EngineOptions,
    AbortSignalOptions {}

/**
 * Parse options for CSV binary.
 * @category Types
 */
export interface ParseBinaryOptions<
  Header extends ReadonlyArray<string> = ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends ParseOptions<Header, Delimiter, Quotation>,
    BinaryOptions {}

/**
 * Strategy for handling column count mismatches between header and data rows.
 *
 * @category Types
 *
 * @remarks
 * **Available strategies**:
 * - `'keep'`: Output rows as-is with their actual length
 *   - Array format: Row length varies, no padding or truncation
 *   - Object format: Treated as `'pad'` (all header keys present, missing values = undefined)
 * - `'pad'`: Ensure all rows match header length
 *   - Array format: Pad short rows with undefined, truncate long rows
 *   - Object format: All header keys present, missing values = undefined, extra values ignored
 * - `'strict'`: Enforce exact header length match
 *   - Both formats: Throws error if row length ≠ header length
 * - `'truncate'`: Handle long rows only, keep short rows as-is
 *   - Array format: Truncate long rows to header length, keep short rows unchanged
 *   - Object format: All header keys present (like `'pad'`), missing values = undefined
 *
 * **Default values**:
 * - Array format: `'keep'`
 * - Object format: `'pad'`
 *
 * **Headerless CSV behavior**:
 * When no header is provided (`header: undefined` or `header: []`):
 * - The strategy option is accepted but effectively behaves as `'keep'`
 * - All rows maintain their actual length with no validation
 * - For explicit headerless mode (`header: []`), only `'keep'` is allowed at runtime
 *
 * @example Array format examples
 *
 * ```ts
 * // Header: ['name', 'age', 'city']
 * // Input row: 'Alice,30'
 * // outputFormat: 'array'
 *
 * // keep → ['Alice', '30'] (short row kept as-is)
 * // pad → ['Alice', '30', undefined] (padded to match header)
 * // strict → Error thrown (length mismatch)
 * // truncate → ['Alice', '30'] (short row kept as-is, only truncates long rows)
 * ```
 *
 * @example Object format examples
 *
 * ```ts
 * // Header: ['name', 'age', 'city']
 * // Input row: 'Alice,30'
 * // outputFormat: 'object'
 *
 * // keep → { name: 'Alice', age: '30', city: undefined } (treated as 'pad')
 * // pad → { name: 'Alice', age: '30', city: undefined } (all keys present)
 * // strict → Error thrown (length mismatch)
 * // truncate → { name: 'Alice', age: '30', city: undefined } (all keys present)
 * ```
 */
export type ColumnCountStrategy = "keep" | "pad" | "strict" | "truncate";

/**
 * CSV record as an object (traditional format).
 *
 * @category Types
 * @template Header Header of the CSV.
 *
 * @remarks
 * This type represents a single CSV record as an object,
 * where each key corresponds to a header field and the value is the field's string content.
 *
 * @example
 *
 * ```ts
 * const header = ["foo", "bar"] as const;
 *
 * type Record = CSVObjectRecord<typeof header>;
 * // { foo: string; bar: string }
 *
 * const record: Record = { foo: "1", bar: "2" };
 * ```
 */
export type CSVObjectRecord<Header extends ReadonlyArray<string>> = Record<
  Header[number],
  string
>;

/**
 * CSV record as an array (named tuple format).
 *
 * @category Types
 * @template Header Header of the CSV.
 * @template Strategy Column count strategy that affects field types (default: 'keep')
 *
 * @remarks
 * This type represents a single CSV record as a readonly array.
 * When a header is provided, it creates a named tuple with type-safe indexing.
 * Without a header, it's a variable-length readonly string array.
 *
 * **Type safety with columnCountStrategy**:
 * - `'keep'`, `'strict'`, `'truncate'`: Fields are typed as `string`
 * - `'pad'`: Fields are typed as `string | undefined` (missing fields padded with undefined)
 *
 * @example With header (named tuple)
 *
 * ```ts
 * const header = ["name", "age", "city"] as const;
 *
 * type Row = CSVArrayRecord<typeof header>;
 * // readonly [name: string, age: string, city: string]
 *
 * const row: Row = ["Alice", "30", "NY"];
 * row[0]; // name: string (type-safe!)
 * row.length; // 3 (compile-time constant)
 * ```
 *
 * @example With pad strategy (allows undefined)
 *
 * ```ts
 * const header = ["name", "age", "city"] as const;
 *
 * type Row = CSVArrayRecord<typeof header, 'pad'>;
 * // readonly [name: string | undefined, age: string | undefined, city: string | undefined]
 *
 * const row: Row = ["Alice", "30", undefined]; // Type-safe!
 * row[2]; // city: string | undefined
 * ```
 *
 * @example Without header (variable-length)
 *
 * ```ts
 * type Row = CSVArrayRecord<readonly []>;
 * // readonly string[]
 *
 * const row: Row = ["Alice", "30"];
 * row[0]; // string
 * row.length; // number (runtime determined)
 * ```
 */
export type CSVArrayRecord<
  Header extends ReadonlyArray<string>,
  Strategy extends ColumnCountStrategy = "keep",
> = Header extends readonly []
  ? readonly string[]
  : Strategy extends "pad"
    ? { readonly [K in keyof Header]: string | undefined }
    : { readonly [K in keyof Header]: string };

/**
 * CSV Record.
 *
 * @category Types
 * @template Header Header of the CSV.
 * @template Format Output format: 'object' or 'array' (default: 'object')
 * @template Strategy Column count strategy for array format (default: 'keep')
 *
 * @remarks
 * This type represents a single CSV record, which can be either an object or an array
 * depending on the `Format` type parameter.
 *
 * - When `Format` is `'object'` (default): Returns {@link CSVObjectRecord}
 * - When `Format` is `'array'`: Returns {@link CSVArrayRecord} (named tuple)
 *
 * For array format, the `Strategy` parameter affects field types:
 * - `'pad'`: Fields are typed as `string | undefined`
 * - Other strategies: Fields are typed as `string`
 *
 * @example Object format (default)
 * ```ts
 * const record: CSVRecord<["foo", "bar"]> = {
 *   foo: "1",
 *   bar: "2",
 * };
 * ```
 *
 * @example Array format (named tuple)
 * ```ts
 * const header = ["foo", "bar"] as const;
 * const record: CSVRecord<typeof header, 'array'> = ["1", "2"];
 * // Type: readonly [foo: string, bar: string]
 * ```
 *
 * @example Array format with pad strategy
 * ```ts
 * const header = ["foo", "bar"] as const;
 * const record: CSVRecord<typeof header, 'array', 'pad'> = ["1", undefined];
 * // Type: readonly [foo: string | undefined, bar: string | undefined]
 * ```
 */
export type CSVRecord<
  Header extends ReadonlyArray<string>,
  Format extends "object" | "array" = "object",
  Strategy extends ColumnCountStrategy = "keep",
> = Format extends "array"
  ? CSVArrayRecord<Header, Strategy>
  : CSVObjectRecord<Header>;

/**
 * Join CSV field array into a CSV-formatted string with proper escaping.
 *
 * @category Types
 *
 * @remarks
 * This type handles CSV-specific formatting:
 * - Quotes fields containing delimiters, quotations, or newlines
 * - Joins fields with the specified delimiter
 *
 * @example Default
 *
 * ```ts
 * const header = ["name", "age", "city", "zip"];
 *
 * type _ = JoinCSVFields<typeof header>
 * // `name,age,city,zip`
 * ```
 *
 * @example With different delimiter and quotation
 *
 * ```ts
 * const header = ["name", "a\nge", "city", "zip"];
 *
 * type _ = JoinCSVFields<typeof header, "@", "$">
 * // `name@$a\nge$@city@zip`
 * ```
 */
export type JoinCSVFields<
  Chars extends ReadonlyArray<string | number | boolean | bigint>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Nl extends string = Exclude<Newline, Delimiter | Quotation>,
> = Chars extends readonly [infer F, ...infer R]
  ? F extends string
    ? R extends string[]
      ? `${F extends `${string}${Nl | Delimiter | Quotation}${string}`
          ? `${Quotation}${F}${Quotation}`
          : F}${R extends [] ? "" : Delimiter}${JoinCSVFields<R, Delimiter, Quotation>}`
      : string
    : string
  : "";

/**
 * Split CSV-formatted string into field array with proper unescaping.
 *
 * @category Types
 *
 * @remarks
 * This type handles CSV-specific parsing:
 * - Unquotes quoted fields
 * - Handles escaped quotation marks
 * - Splits by the specified delimiter
 *
 * @example Default
 *
 * ```ts
 * const header = `name,age,city,zip`;
 *
 * type _ = SplitCSVFields<typeof header>
 * // ["name", "age", "city", "zip"]
 * ```
 *
 * @example With different delimiter and quotation
 *
 * ```ts
 * const header = `name@$a
 * ge$@city@zip`;
 *
 * type _ = SplitCSVFields<typeof header, "@", "$">
 * // ["name", "a\nge", "city", "zip"]
 * ```
 */
export type SplitCSVFields<
  Char extends string,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Escaping extends boolean = false,
  Col extends string = "",
  Result extends string[] = [],
> = Char extends `${Delimiter}${infer R}`
  ? Escaping extends true
    ? SplitCSVFields<
        R,
        Delimiter,
        Quotation,
        true,
        `${Col}${Delimiter}`,
        Result
      >
    : SplitCSVFields<R, Delimiter, Quotation, false, "", [...Result, Col]>
  : Char extends `${Quotation}${infer R}`
    ? Escaping extends true
      ? R extends "" | Delimiter | `${Delimiter}${string}`
        ? SplitCSVFields<R, Delimiter, Quotation, false, Col, Result>
        : SplitCSVFields<
            R,
            Delimiter,
            Quotation,
            true,
            `${Col}${Quotation}`,
            Result
          >
      : SplitCSVFields<R, Delimiter, Quotation, true, Col, Result>
    : Char extends `${infer F}${infer R}`
      ? SplitCSVFields<R, Delimiter, Quotation, Escaping, `${Col}${F}`, Result>
      : [...Result, Col] extends [""]
        ? readonly string[]
        : readonly [...Result, Col];

/**
 * CSV string data (value or stream).
 *
 * @category Types
 */
export type CSVString = string | ReadableStream<string>;

/**
 * CSV binary data (all binary formats).
 *
 * @category Types
 */
export type CSVBinary =
  | BufferSource
  | ReadableStream<Uint8Array>
  | Response
  | Request
  | Blob;

/**
 * CSV data (all supported formats for parsing).
 *
 * @category Types
 */
export type CSVData = CSVString | CSVBinary;

/**
 * Extracts the string type from CSVString for type-level processing.
 *
 * @remarks
 * - For string literals: Returns the literal type for pattern matching
 * - For ReadableStream: Returns the element type (falls back to string for type inference)
 * - This is an internal utility type for header extraction from CSV data
 *
 * @internal
 */
type ExtractString<Source extends CSVString> = Source extends `${infer S}`
  ? S
  : Source extends ReadableStream<infer R>
    ? R
    : string;

/**
 * Extracts the CSV body (everything after the header line) for type-level parsing.
 *
 * @remarks
 * This is a recursive type that processes CSV content character by character,
 * handling:
 * - Quoted fields with the specified quotation character
 * - Escaped quotation marks within quoted fields
 * - Newline characters that terminate the header
 *
 * @internal
 */
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
  ? SplitCSVFields<
      ExtractCSVHeader<S, Delimiter, Quotation>,
      Delimiter,
      Quotation
    >
  : ReadonlyArray<string>;

/**
 * Options for the CSVLexer.lex method.
 */
export interface CSVLexerLexOptions {
  /**
   * If true, indicates that more chunks are expected.
   * If false or omitted, flushes remaining data.
   */
  stream?: boolean;
}

/**
 * String CSV Lexer interface
 *
 * StringCSVLexer tokenizes string CSV data into fields and records.
 */
export interface StringCSVLexer {
  /**
   * Lexes the given chunk of CSV string data.
   * @param chunk - The chunk of CSV string data to be lexed. Omit to flush remaining data.
   * @param options - Lexer options.
   * @returns An iterable iterator of tokens.
   */
  lex(chunk?: string, options?: CSVLexerLexOptions): IterableIterator<Token>;
}

/**
 * Binary CSV Lexer interface
 *
 * BinaryCSVLexer tokenizes binary CSV data (Uint8Array) into fields and records.
 */
export interface BinaryCSVLexer {
  /**
   * Lexes the given chunk of CSV binary data.
   * @param chunk - The chunk of CSV binary data (Uint8Array) to be lexed. Omit to flush remaining data.
   * @param options - Lexer options.
   * @returns An iterable iterator of tokens.
   */
  lex(
    chunk?: Uint8Array,
    options?: CSVLexerLexOptions,
  ): IterableIterator<Token>;
}

/**
 * Options for the CSVRecordAssembler.assemble method.
 */
export interface CSVRecordAssemblerAssembleOptions {
  /**
   * If true, indicates that more tokens are expected.
   * If false or omitted, flushes remaining data.
   */
  stream?: boolean;
}

/**
 * CSV Object Record Assembler interface.
 *
 * CSVObjectRecordAssembler assembles tokens into CSV records in object format.
 * Each record is returned as an object with header keys mapping to field values.
 *
 * This interface is designed to be easily implemented in Rust/WASM with clear type semantics.
 *
 * @template Header - Array of header field names
 *
 * @example
 * ```typescript
 * const assembler: CSVObjectRecordAssembler<['name', 'age']> = ...;
 * for (const record of assembler.assemble(tokens)) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 */
export interface CSVObjectRecordAssembler<
  Header extends ReadonlyArray<string>,
> {
  /**
   * Assembles tokens into CSV records in object format.
   * @param input - A token or iterable of tokens to be assembled. Omit to flush remaining data.
   * @param options - Assembler options.
   * @returns An iterable iterator of CSV records as objects.
   */
  assemble(
    input?: Token | Iterable<Token>,
    options?: CSVRecordAssemblerAssembleOptions,
  ): IterableIterator<CSVObjectRecord<Header>>;
}

/**
 * CSV Array Record Assembler interface.
 *
 * CSVArrayRecordAssembler assembles tokens into CSV records in array format.
 * Each record is returned as a tuple/array with values in header order.
 *
 * This interface is designed to be easily implemented in Rust/WASM with clear type semantics.
 *
 * @template Header - Array of header field names (determines array length and named tuple structure)
 *
 * @example
 * ```typescript
 * const assembler: CSVArrayRecordAssembler<['name', 'age']> = ...;
 * for (const record of assembler.assemble(tokens)) {
 *   console.log(record); // ['Alice', '30'] - typed as named tuple
 * }
 * ```
 */
export interface CSVArrayRecordAssembler<Header extends ReadonlyArray<string>> {
  /**
   * Assembles tokens into CSV records in array format.
   * @param input - A token or iterable of tokens to be assembled. Omit to flush remaining data.
   * @param options - Assembler options.
   * @returns An iterable iterator of CSV records as arrays/tuples.
   */
  assemble(
    input?: Token | Iterable<Token>,
    options?: CSVRecordAssemblerAssembleOptions,
  ): IterableIterator<CSVArrayRecord<Header>>;
}

/**
 * Unified CSV Record Assembler type.
 *
 * This is a discriminated union type that can represent either object or array assemblers.
 * Use this when you need to work with assemblers in a format-agnostic way.
 *
 * @template Header - Array of header field names
 * @template Format - Output format: 'object' or 'array' (default: 'object')
 */
export type CSVRecordAssembler<
  Header extends ReadonlyArray<string>,
  Format extends "object" | "array" = "object",
> = Format extends "array"
  ? CSVArrayRecordAssembler<Header>
  : CSVObjectRecordAssembler<Header>;

/**
 * Options for the parse method
 */
export interface CSVParserParseOptions {
  /**
   * Whether to process in streaming mode
   */
  stream?: boolean;
}

/**
 * Options for CSV Parser
 */
export interface CSVParserOptions<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  /**
   * Field delimiter character
   */
  delimiter?: string;
  /**
   * Quotation character
   */
  quotation?: string;
  /**
   * Custom header array
   */
  header?: Header;
  /**
   * Maximum field count limit
   */
  maxFieldCount?: number;
}

/**
 * String CSV Parser interface
 * @template Header - The type of the header row
 */
export interface StringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  /**
   * Parse a chunk of CSV string data
   * @param chunk - CSV string chunk to parse (optional for flush)
   * @param options - Parse options
   * @returns Array of parsed CSV records
   */
  parse(chunk?: string, options?: CSVParserParseOptions): CSVRecord<Header>[];
}

/**
 * Binary CSV Parser interface
 * @template Header - The type of the header row
 */
export interface BinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  /**
   * Parse a chunk of CSV binary data
   * @param chunk - CSV binary chunk (Uint8Array) to parse (optional for flush)
   * @param options - Parse options
   * @returns Array of parsed CSV records
   */
  parse(
    chunk?: Uint8Array,
    options?: CSVParserParseOptions,
  ): CSVRecord<Header>[];
}
