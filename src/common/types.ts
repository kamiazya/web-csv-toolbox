import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../constants.ts";
import type { Join } from "../utils/types.ts";
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
  /**
   * Buffer cleanup threshold in characters.
   *
   * @remarks
   * When the processed buffer offset exceeds this threshold,
   * the buffer is sliced to reduce memory usage.
   *
   * This value affects the balance between performance and memory usage:
   * - 0: Disables buffer cleanup (maximum memory usage, best performance for small files)
   * - Smaller values (512B-2KB): More frequent cleanup, lower memory usage, higher CPU overhead
   * - Larger values (16KB-64KB): Less frequent cleanup, higher memory usage, lower CPU overhead
   *
   * Based on comprehensive benchmarking, 4KB provides optimal performance
   * for most use cases. You may adjust this value based on your specific needs:
   * - Small files or low memory constraints: 0 (disabled) or 1-2KB
   * - Mixed field sizes: 4KB (default, recommended)
   * - Very large fields (> 10KB): Consider 16-64KB
   *
   * @default 4 * 1024 (4KB)
   */
  bufferCleanupThreshold?: number;
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
  decompression?: CompressionFormat;
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
  maxBinarySize?: number;
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
  allowExperimentalCompressions?: boolean;
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
  error?: Error;
}

/**
 * Engine configuration for CSV parsing.
 *
 * All parsing engine settings are unified in this interface.
 *
 * @category Types
 */
export interface EngineConfig {
  /**
   * Execute in Worker thread.
   *
   * @default false
   *
   * @example Worker execution
   * ```ts
   * parse(csv, { engine: { worker: true } })
   * ```
   */
  worker?: boolean;

  /**
   * Custom Worker URL.
   * Only applicable when `worker: true`.
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
  workerURL?: string | URL;

  /**
   * Worker pool for managing worker lifecycle.
   * Only applicable when `worker: true`.
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
  workerPool?: import("../execution/worker/helpers/WorkerPool.ts").WorkerPool;

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
  wasm?: boolean;

  /**
   * Worker communication strategy.
   * Only applicable when `worker: true`.
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
  workerStrategy?: WorkerCommunicationStrategy;

  /**
   * Strict mode: disable automatic fallback.
   * Only applicable when `workerStrategy: "stream-transfer"`.
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
  strict?: boolean;

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
  onFallback?: (info: EngineFallbackInfo) => void;
}

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
 * Backpressure monitoring options.
 *
 * @category Types
 */
export interface BackpressureOptions {
  /**
   * How often to check for backpressure (in number of items processed).
   *
   * Lower values = more responsive to backpressure but slight performance overhead.
   * Higher values = less overhead but slower backpressure response.
   *
   * Default:
   * - CSVLexerTransformer: 100 tokens
   * - CSVRecordAssemblerTransformer: 10 records
   */
  checkInterval?: number;
}

/**
 * Extended queuing strategy with backpressure monitoring options.
 *
 * @category Types
 */
export interface ExtendedQueuingStrategy<T>
  extends QueuingStrategy<T>,
    BackpressureOptions {}

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
