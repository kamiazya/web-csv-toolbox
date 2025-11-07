import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  Newline,
} from "../constants.ts";
import type { WorkerPool } from "../execution/worker/helpers/WorkerPool.ts";
import type { Field, FieldDelimiter, RecordDelimiter } from "./constants.ts";

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
    AbortSignalOptions {
  /**
   * How often to check for backpressure (in number of tokens processed).
   *
   * Lower values = more responsive to backpressure but slight performance overhead.
   * Higher values = less overhead but slower backpressure response.
   *
   * @default 100
   */
  backpressureCheckInterval?: number;
}

/**
 * CSV Record Assembler Options.
 * @category Types
 *
 * @remarks
 * If you specify `header: ['foo', 'bar']`,
 * the first record will be treated as a normal record.
 *
 * If you don't specify `header`,
 * the first record will be treated as a header.
 */
export interface CSVRecordAssemblerOptions<Header extends ReadonlyArray<string>>
  extends SourceOption,
    AbortSignalOptions {
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
  /**
   * Maximum number of fields allowed per record.
   *
   * @remarks
   * This option limits the number of columns/fields in a CSV record
   * to prevent memory exhaustion attacks. When a record exceeds this limit,
   * a {@link FieldCountLimitError} will be thrown.
   *
   * Set to `Number.POSITIVE_INFINITY` to disable the limit (not recommended for untrusted input).
   *
   * @default 100000
   */
  maxFieldCount?: number;

  /**
   * When true, completely empty lines (with only delimiters or whitespace)
   * will be skipped during parsing.
   *
   * @default false
   */
  skipEmptyLines?: boolean;

  /**
   * How often to check for backpressure (in number of records processed).
   *
   * Lower values = more responsive to backpressure but slight performance overhead.
   * Higher values = less overhead but slower backpressure response.
   *
   * @default 10
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
   * Requires prior initialization with {@link loadWASM}.
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
   * - Files equal to or larger than threshold: Use `blob.stream()` + `parseUint8ArrayStream()`
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
 * Parse options for CSV string.
 * @category Types
 */
export interface ParseOptions<
  Header extends ReadonlyArray<string> = ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends CommonOptions<Delimiter, Quotation>,
    CSVRecordAssemblerOptions<Header>,
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
      | JoinCSVFields<Header, Delimiter, Quotation>
      | ReadableStream<JoinCSVFields<Header, Delimiter, Quotation>>
  : string | ReadableStream<string>;

/**
 * CSV Binary.
 *
 * @category Types
 */
export type CSVBinary =
  | ReadableStream<Uint8Array>
  | Response
  | Request
  | Blob
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

type ExtractString<Source extends CSVString> = Source extends `${infer S}`
  ? S
  : Source extends ReadableStream<infer R>
    ? R
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
  ? SplitCSVFields<
      ExtractCSVHeader<S, Delimiter, Quotation>,
      Delimiter,
      Quotation
    >
  : ReadonlyArray<string>;
