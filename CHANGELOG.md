# web-csv-toolbox

## 0.14.0

### Minor Changes

- [#603](https://github.com/kamiazya/web-csv-toolbox/pull/603) [`d03ad12`](https://github.com/kamiazya/web-csv-toolbox/commit/d03ad128fb9e0247adafe6a3e3c529fb6449dc5c) Thanks [@kamiazya](https://github.com/kamiazya)! - feat!: rename binary stream APIs for consistency and add BufferSource support

  ## Summary

  This release standardizes the naming of binary stream parsing APIs to match the existing `parseBinary*` family, and extends support to accept any BufferSource type (ArrayBuffer, Uint8Array, and other TypedArray views).

  ## Breaking Changes

  ### API Renaming for Consistency

  All `parseUint8Array*` functions have been renamed to `parseBinary*` to maintain consistency with existing binary parsing APIs:

  **Function Names:**

  - `parseUint8ArrayStream()` → `parseBinaryStream()`
  - `parseUint8ArrayStreamToStream()` → `parseBinaryStreamToStream()`

  **Type Names:**

  - `ParseUint8ArrayStreamOptions` → `ParseBinaryStreamOptions`

  **Internal Functions (for reference):**

  - `parseUint8ArrayStreamInMain()` → `parseBinaryStreamInMain()`
  - `parseUint8ArrayStreamInWorker()` → `parseBinaryStreamInWorker()`
  - `parseUint8ArrayStreamInWorkerWASM()` → `parseBinaryStreamInWorkerWASM()`

  **Rationale:**
  The previous naming was inconsistent with the rest of the binary API family (`parseBinary`, `parseBinaryToArraySync`, `parseBinaryToIterableIterator`, `parseBinaryToStream`). The new naming provides:

  - Perfect consistency across all binary parsing APIs
  - Clear indication that these functions accept any binary data format
  - Better predictability for API discovery

  ### BufferSource Support

  `FlexibleBinaryCSVParser` and `BinaryCSVParserStream` now accept `BufferSource` (= `ArrayBuffer | ArrayBufferView`) instead of just `Uint8Array`:

  **Before:**

  ```typescript
  const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
  const data = new Uint8Array([...]); // Only Uint8Array
  const records = parser.parse(data);
  ```

  **After:**

  ```typescript
  const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });

  // Uint8Array still works
  const uint8Data = new Uint8Array([...]);
  const records1 = parser.parse(uint8Data);

  // ArrayBuffer now works directly
  const buffer = await fetch('data.csv').then(r => r.arrayBuffer());
  const records2 = parser.parse(buffer);

  // Other TypedArray views also work
  const int8Data = new Int8Array([...]);
  const records3 = parser.parse(int8Data);
  ```

  **Benefits:**

  - Direct use of `fetch().then(r => r.arrayBuffer())` without conversion
  - Flexibility to work with any TypedArray view
  - Alignment with Web API standards (BufferSource is widely used)

  ## Migration Guide

  ### Automatic Migration

  Use find-and-replace in your codebase:

  ```bash
  # Function calls
  parseUint8ArrayStream → parseBinaryStream
  parseUint8ArrayStreamToStream → parseBinaryStreamToStream

  # Type references
  ParseUint8ArrayStreamOptions → ParseBinaryStreamOptions
  ```

  ### TypeScript Users

  If you were explicitly typing with `Uint8Array`, you can now use the more general `BufferSource`:

  ```typescript
  // Before
  function processCSV(data: Uint8Array) {
    return parseBinaryStream(data);
  }

  // After (more flexible)
  function processCSV(data: BufferSource) {
    return parseBinaryStream(data);
  }
  ```

  ## Updated API Consistency

  All binary parsing APIs now follow a consistent naming pattern:

  ```typescript
  // Single-value binary data
  parseBinary(); // Binary → AsyncIterableIterator<Record>
  parseBinaryToArraySync(); // Binary → Array<Record> (sync)
  parseBinaryToIterableIterator(); // Binary → IterableIterator<Record>
  parseBinaryToStream(); // Binary → ReadableStream<Record>

  // Streaming binary data
  parseBinaryStream(); // ReadableStream<Uint8Array> → AsyncIterableIterator<Record>
  parseBinaryStreamToStream(); // ReadableStream<Uint8Array> → ReadableStream<Record>
  ```

  **Note:** While the stream input type remains `ReadableStream<Uint8Array>` (Web Streams API standard), the internal parsers now accept `BufferSource` for individual chunks.

  ## Documentation Updates

  ### README.md

  - Updated Low-level APIs section to reflect `parseBinaryStream*` naming
  - Added flush procedure documentation for streaming mode
  - Added BufferSource examples

  ### API Reference (docs/reference/package-exports.md)

  - Added comprehensive Low-level API Reference section
  - Documented all Parser Models (Tier 1) and Lexer + Assembler (Tier 2)
  - Included usage examples and code snippets

  ### Architecture Guide (docs/explanation/parsing-architecture.md)

  - Updated Binary CSV Parser section to document BufferSource support
  - Added detailed streaming mode examples with flush procedures
  - Clarified multi-byte character handling across chunk boundaries

  ## Flush Procedure Clarification

  Documentation now explicitly covers the requirement to call `parse()` without arguments when using streaming mode:

  ```typescript
  const parser = createBinaryCSVParser({ header: ["name", "age"] });
  const encoder = new TextEncoder();

  // Process chunks
  const records1 = parser.parse(encoder.encode("Alice,30\nBob,"), {
    stream: true,
  });
  const records2 = parser.parse(encoder.encode("25\n"), { stream: true });

  // IMPORTANT: Flush remaining data (required!)
  const records3 = parser.parse();
  ```

  This prevents data loss from incomplete records or multi-byte character buffers.

  ## Type Safety

  All changes maintain full TypeScript strict mode compliance with proper type inference and generic constraints.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Add `arrayBufferThreshold` option to Engine configuration for automatic Blob reading strategy selection

  ## New Feature

  Added `engine.arrayBufferThreshold` option that automatically selects the optimal Blob reading strategy based on file size:

  - **Files smaller than threshold**: Use `blob.arrayBuffer()` + `parseBinary()` (6-8x faster, confirmed by benchmarks)
  - **Files equal to or larger than threshold**: Use `blob.stream()` + `parseBinaryStream()` (memory-efficient)

  **Default:** 1MB (1,048,576 bytes), determined by comprehensive benchmarks

  **Applies to:** `parseBlob()` and `parseFile()` only

  ## Benchmark Results

  | File Size | Binary (ops/sec) | Stream (ops/sec) | Performance Gain |
  | --------- | ---------------- | ---------------- | ---------------- |
  | 1KB       | 21,691           | 2,685            | **8.08x faster** |
  | 10KB      | 2,187            | 311              | **7.03x faster** |
  | 100KB     | 219              | 32               | **6.84x faster** |
  | 1MB       | 20               | 3                | **6.67x faster** |

  ## Usage

  ```typescript
  import { parseBlob, EnginePresets } from "web-csv-toolbox";

  // Use default (1MB threshold)
  for await (const record of parseBlob(file)) {
    console.log(record);
  }

  // Always use streaming (memory-efficient)
  for await (const record of parseBlob(largeFile, {
    engine: { arrayBufferThreshold: 0 },
  })) {
    console.log(record);
  }

  // Custom threshold (512KB)
  for await (const record of parseBlob(file, {
    engine: { arrayBufferThreshold: 512 * 1024 },
  })) {
    console.log(record);
  }

  // With preset
  for await (const record of parseBlob(file, {
    engine: EnginePresets.fastest({
      arrayBufferThreshold: 2 * 1024 * 1024, // 2MB
    }),
  })) {
    console.log(record);
  }
  ```

  ## Special Values

  - `0` - Always use streaming (maximum memory efficiency)
  - `Infinity` - Always use arrayBuffer (maximum performance for small files)

  ## Security Note

  When using `arrayBufferThreshold > 0`, files must stay below `maxBufferSize` (default 10MB) to prevent excessive memory allocation. Files exceeding this limit will throw a `RangeError`.

  ## Design Philosophy

  This option belongs to `engine` configuration because it affects **performance and behavior only**, not the parsing result specification. This follows the design principle:

  - **Top-level options**: Affect specification (result changes)
  - **Engine options**: Affect performance/behavior (same result, different execution)

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Add support for Blob, File, and Request objects

  This release adds native support for parsing CSV data from Web Standard `Blob`, `File`, and `Request` objects, making the library more versatile across different environments.

  **New Functions:**

  - **`parseBlob(blob, options)`** - Parse CSV from Blob or File objects

    - Automatic charset detection from `blob.type` property
    - Supports compression via `decompression` option
    - Returns `AsyncIterableIterator<CSVRecord>`
    - Includes `.toArray()` and `.toStream()` namespace methods

  - **`parseFile(file, options)`** - Enhanced File parsing with automatic error source tracking

    - Built on top of `parseBlob` with additional functionality
    - **Automatically sets `file.name` as error source** for better error reporting
    - Provides clearer intent when working specifically with File objects
    - Useful for file inputs and drag-and-drop scenarios
    - Includes `.toArray()` and `.toStream()` namespace methods

  - **`parseRequest(request, options)`** - Server-side Request parsing
    - Automatic `Content-Type` validation and charset extraction
    - Automatic `Content-Encoding` detection and decompression
    - Designed for Cloudflare Workers, Service Workers, and edge platforms
    - Includes `.toArray()` and `.toStream()` namespace methods

  **High-level API Integration:**

  The `parse()` function now automatically detects and handles these new input types:

  ```typescript
  import { parse } from "web-csv-toolbox";

  // Blob/File (browser file uploads)
  // File objects automatically include filename in error messages
  const file = input.files[0];
  for await (const record of parse(file)) {
    console.log(record);
  }

  // Request (server-side)
  export default {
    async fetch(request: Request) {
      for await (const record of parse(request)) {
        console.log(record);
      }
    },
  };
  ```

  **Type System Updates:**

  - Updated `CSVBinary` type to include `Blob` and `Request`
  - Added proper type overloads to `parse()` function
  - Full TypeScript support with generic header types
  - **New `source` field** in `CommonOptions`, `CSVRecordAssemblerOptions`, and `ParseError`
    - Allows custom error source identification (e.g., filename, description)
    - Automatically populated for File objects
    - Improves error messages with contextual information
  - **Improved internal type naming** for better clarity
    - `Join` → `JoinCSVFields` - More descriptive CSV field joining utility type
    - `Split` → `SplitCSVFields` - More descriptive CSV field splitting utility type
    - These are internal utility types used for CSV type-level string manipulation
  - **Enhanced terminology** in type definitions
    - `TokenLocation.rowNumber` - Logical CSV row number (includes header)
    - Clear distinction between physical line numbers (`line`) and logical row numbers (`rowNumber`)

  **Compression Support:**

  All binary input types support compressed data:

  - **Blob/File**: Manual specification via `decompression` option

    ```typescript
    parseBlob(file, { decompression: "gzip" });
    ```

  - **Request**: Automatic detection from `Content-Encoding` header

    ```typescript
    // No configuration needed - automatic
    parseRequest(request);
    ```

  - Supported formats: `gzip`, `deflate`, `deflate-raw` (environment-dependent)

  **Helper Functions:**

  - `getOptionsFromBlob()` - Extracts charset from Blob MIME type
  - `getOptionsFromFile()` - Extracts options from File (charset + automatic source naming)
  - `getOptionsFromRequest()` - Processes Request headers (Content-Type, Content-Encoding)
  - `parseBlobToStream()` - Stream conversion helper
  - `parseFileToArray()` - Parse File to array of records
  - `parseFileToStream()` - Parse File to ReadableStream
  - `parseRequestToStream()` - Stream conversion helper

  **Documentation:**

  Comprehensive documentation following Diátaxis framework:

  - **API Reference:**

    - `parseBlob.md` - Complete API reference with examples
    - `parseFile.md` - Alias documentation
    - `parseRequest.md` - Server-side API reference with examples
    - Updated `parse.md` to include new input types

  - **How-to Guides:**

    - **NEW:** `platform-usage/` - Environment-specific usage patterns organized by platform
      - Each topic has its own dedicated guide for easy navigation
      - **Browser:** File input, drag-and-drop, FormData, Fetch API
      - **Node.js:** Buffer, fs.ReadStream, HTTP requests, stdin/stdout
      - **Deno:** Deno.readFile, Deno.open, fetch API
    - Organized in `{environment}/{topic}.md` structure for maintainability

  - **Examples:**

    - File input elements with HTML samples
    - Drag-and-drop file uploads
    - Compressed file handling (.csv.gz)
    - Validation and error handling patterns
    - **NEW:** Node.js Buffer usage (supported via BufferSource compatibility)
    - **NEW:** FormData integration patterns
    - **NEW:** Node.js stream conversion (fs.ReadStream → Web Streams)

  - **Updated:**
    - `README.md` - Added usage examples and API listings
    - `choosing-the-right-api.md` - Updated decision tree

  **Enhanced Error Reporting:**

  The `source` field provides better error context when parsing multiple files:

  ```typescript
  import { parseFile } from "web-csv-toolbox";

  // Automatic source tracking
  try {
    for await (const record of parseFile(file)) {
      // ...
    }
  } catch (error) {
    console.error(error.message);
    // "Field count (100001) exceeded maximum allowed count of 100000 at row 5 in "data.csv""
    console.error(error.source); // "data.csv"
  }

  // Manual source specification
  parseString(csv, { source: "API-Export-2024" });
  // Error: "... at row 5 in "API-Export-2024""
  ```

  **Security Note:** The `source` field should not contain sensitive information (API keys, tokens, URLs with credentials) as it may be exposed in error messages and logs.

  **Use Cases:**

  ✅ **Browser File Uploads:**

  - File input elements (`<input type="file">`)
  - Drag-and-drop interfaces
  - Compressed file support (.csv.gz)

  ✅ **Server-Side Processing:**

  - Node.js servers
  - Deno applications
  - Service Workers

  ✅ **Automatic Header Processing:**

  - Content-Type validation
  - Charset detection
  - Content-Encoding decompression

  **Platform Support:**

  All new APIs work across:

  - Modern browsers (Chrome, Firefox, Edge, Safari)
  - Node.js 18+ (via undici Request/Blob)
  - Deno
  - Service Workers

  **Breaking Changes:**

  None - this is a purely additive feature. All existing APIs remain unchanged.

  **Migration:**

  No migration needed. New functions are available immediately:

  ```typescript
  // Before (still works)
  import { parse } from "web-csv-toolbox";
  const response = await fetch("data.csv");
  for await (const record of parse(response)) {
  }

  // After (new capabilities)
  import { parseBlob, parseFile, parseRequest } from "web-csv-toolbox";

  // Blob support
  for await (const record of parseBlob(blob)) {
  }

  // File support with automatic error source
  const file = input.files[0];
  for await (const record of parseFile(file)) {
  }
  // Errors will include: 'in "data.csv"'

  // Server-side Request support
  for await (const record of parseRequest(request)) {
  }

  // Custom error source for any parser
  import { parseString } from "web-csv-toolbox";
  for await (const record of parseString(csv, { source: "user-import.csv" })) {
  }
  ```

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Implement discriminated union pattern for `EngineConfig` to improve type safety

  ## Breaking Changes

  ### 1. EngineConfig Type Structure

  `EngineConfig` is now a discriminated union based on the `worker` property:

  **Before:**

  ```typescript
  interface EngineConfig {
    worker?: boolean;
    workerURL?: string | URL;
    workerPool?: WorkerPool;
    workerStrategy?: WorkerCommunicationStrategy;
    strict?: boolean;
    onFallback?: (info: EngineFallbackInfo) => void;
    wasm?: boolean;
    // ... other properties
  }
  ```

  **After:**

  ```typescript
  // Base configuration shared by all modes
  interface BaseEngineConfig {
    wasm?: boolean;
    arrayBufferThreshold?: number;
    backpressureCheckInterval?: BackpressureCheckInterval;
    queuingStrategy?: QueuingStrategyConfig;
  }

  // Main thread configuration (worker is false or undefined)
  interface MainThreadEngineConfig extends BaseEngineConfig {
    worker?: false;
  }

  // Worker configuration (worker must be true)
  interface WorkerEngineConfig extends BaseEngineConfig {
    worker: true;
    workerURL?: string | URL;
    workerPool?: WorkerPool;
    workerStrategy?: WorkerCommunicationStrategy;
    strict?: boolean;
    onFallback?: (info: EngineFallbackInfo) => void;
  }

  // Union type
  type EngineConfig = MainThreadEngineConfig | WorkerEngineConfig;
  ```

  ### 2. Type Safety Improvements

  Worker-specific properties are now only available when `worker: true`:

  ```typescript
  // ✅ Valid - worker: true allows worker-specific properties
  const config1: EngineConfig = {
    worker: true,
    workerURL: "./worker.js", // ✅ Type-safe
    workerStrategy: "stream-transfer",
    strict: true,
  };

  // ✅ Valid - worker: false doesn't require worker properties
  const config2: EngineConfig = {
    worker: false,
    wasm: true,
  };

  // ❌ Type Error - worker: false cannot have workerURL
  const config3: EngineConfig = {
    worker: false,
    workerURL: "./worker.js", // ❌ Type error!
  };
  ```

  ### 3. EnginePresets Options Split

  `EnginePresetOptions` is now split into two interfaces for better type safety:

  **Before:**

  ```typescript
  interface EnginePresetOptions {
    workerPool?: WorkerPool;
    workerURL?: string | URL;
    onFallback?: (info: EngineFallbackInfo) => void;
    arrayBufferThreshold?: number;
    // ...
  }

  EnginePresets.mainThread(options?: EnginePresetOptions)
  EnginePresets.fastest(options?: EnginePresetOptions)
  ```

  **After:**

  ```typescript
  // For main thread presets (mainThread, wasm)
  interface MainThreadPresetOptions extends BasePresetOptions {
    // No worker-related options
  }

  // For worker-based presets (worker, fastest, balanced, etc.)
  interface WorkerPresetOptions extends BasePresetOptions {
    workerPool?: WorkerPool;
    workerURL?: string | URL;
    onFallback?: (info: EngineFallbackInfo) => void;
  }

  EnginePresets.mainThread(options?: MainThreadPresetOptions)
  EnginePresets.fastest(options?: WorkerPresetOptions)
  ```

  **Migration:**

  ```typescript
  // Before: No type error, but logically incorrect
  EnginePresets.mainThread({ workerURL: "./worker.js" }); // Accepted but ignored

  // After: Type error prevents mistakes
  EnginePresets.mainThread({ workerURL: "./worker.js" }); // ❌ Type error!
  ```

  ### 4. Transformer Constructor Changes

  Queuing strategy parameters changed from optional (`?`) to default parameters:

  **Before:**

  ```typescript
  constructor(
    options?: CSVLexerTransformerOptions,
    writableStrategy?: QueuingStrategy<string>,
    readableStrategy?: QueuingStrategy<Token>
  )
  ```

  **After:**

  ```typescript
  constructor(
    options: CSVLexerTransformerOptions = {},
    writableStrategy: QueuingStrategy<string> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<Token> = DEFAULT_READABLE_STRATEGY
  )
  ```

  **Impact:** This is technically a breaking change in the type signature, but **functionally backward compatible** since all parameters still have defaults. Existing code will continue to work without modifications.

  ## New Features

  ### 1. Default Strategy Constants

  Default queuing strategies are now module-level constants using `CountQueuingStrategy`:

  ```typescript
  // CSVLexerTransformer
  const DEFAULT_WRITABLE_STRATEGY: QueuingStrategy<string> = {
    highWaterMark: 65536,
    size: (chunk) => chunk.length,
  };
  const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
    highWaterMark: 1024,
  });

  // CSVRecordAssemblerTransformer
  const DEFAULT_WRITABLE_STRATEGY = new CountQueuingStrategy({
    highWaterMark: 1024,
  });
  const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
    highWaterMark: 256,
  });
  ```

  ### 2. Type Tests

  Added comprehensive type tests in `src/common/types.test-d.ts` to validate the discriminated union behavior:

  ```typescript
  // Validates type narrowing
  const config: EngineConfig = { worker: true };
  expectTypeOf(config).toExtend<WorkerEngineConfig>();

  // Validates property exclusion
  expectTypeOf<MainThreadEngineConfig>().not.toHaveProperty("workerURL");
  ```

  ## Migration Guide

  ### For TypeScript Users

  If you're passing `EngineConfig` objects explicitly typed, you may need to update:

  ```typescript
  // Before: Could accidentally mix incompatible properties
  const config: EngineConfig = {
    worker: false,
    workerURL: "./worker.js", // Silently ignored
  };

  // After: TypeScript catches the mistake
  const config: EngineConfig = {
    worker: false,
    // workerURL: './worker.js'  // ❌ Type error - removed
  };
  ```

  ### For EnginePresets Users

  Update preset option types if explicitly typed:

  ```typescript
  // Before
  const options: EnginePresetOptions = {
    workerPool: myPool,
  };
  EnginePresets.mainThread(options); // No error, but workerPool ignored

  // After
  const options: WorkerPresetOptions = {
    // or MainThreadPresetOptions
    workerPool: myPool,
  };
  EnginePresets.fastest(options); // ✅ Correct usage
  // EnginePresets.mainThread(options);  // ❌ Type error - use MainThreadPresetOptions
  ```

  ### For Transformer Users

  No code changes required. Existing usage continues to work:

  ```typescript
  // Still works exactly as before
  new CSVLexerTransformer();
  new CSVLexerTransformer({ delimiter: "," });
  new CSVLexerTransformer({}, customWritable, customReadable);
  ```

  ## Benefits

  1. **IDE Autocomplete**: Better suggestions based on `worker` setting
  2. **Type Safety**: Prevents invalid property combinations
  3. **Self-Documenting**: Type system enforces valid configurations
  4. **Catch Errors Early**: TypeScript catches configuration mistakes at compile time
  5. **Standards Compliance**: Uses `CountQueuingStrategy` from Web Streams API

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - refactor!: rename engine presets to clarify optimization targets

  This release improves the naming of engine presets to clearly indicate what each preset optimizes for. The new names focus on performance characteristics (stability, UI responsiveness, parse speed, memory efficiency) rather than implementation details.

  ## Breaking Changes

  ### Engine Preset Renaming

  Engine presets have been renamed to better communicate their optimization targets:

  ```diff
  - import { EnginePresets } from 'web-csv-toolbox';
  + import { EnginePresets } from 'web-csv-toolbox';

  - engine: EnginePresets.mainThread()
  + engine: EnginePresets.stable()

  - engine: EnginePresets.worker()
  + engine: EnginePresets.responsive()

  - engine: EnginePresets.workerStreamTransfer()
  + engine: EnginePresets.memoryEfficient()

  - engine: EnginePresets.wasm()
  + engine: EnginePresets.fast()

  - engine: EnginePresets.workerWasm()
  + engine: EnginePresets.responsiveFast()
  ```

  **Optimization targets:**

  | Preset              | Optimizes For                                  |
  | ------------------- | ---------------------------------------------- |
  | `stable()`          | Stability (uses only standard JavaScript APIs) |
  | `responsive()`      | UI responsiveness (non-blocking)               |
  | `memoryEfficient()` | Memory efficiency (zero-copy streams)          |
  | `fast()`            | Parse speed (fastest execution time)           |
  | `responsiveFast()`  | UI responsiveness + parse speed                |
  | `balanced()`        | Balanced (general-purpose)                     |

  ### Removed Presets

  Two presets have been removed:

  ```diff
  - engine: EnginePresets.fastest()
  + engine: EnginePresets.responsiveFast()

  - engine: EnginePresets.strict()
    // No replacement - limited use case
  ```

  **Why removed:**

  - `fastest()`: Misleading name - prioritized UI responsiveness over raw execution speed due to worker communication overhead
  - `strict()`: Limited use case - primarily for testing/debugging

  ## Improvements

  ### Clearer Performance Documentation

  Each preset now explicitly documents its performance characteristics:

  - **Parse speed**: How fast CSV parsing executes
  - **UI responsiveness**: Whether parsing blocks the main thread
  - **Memory efficiency**: Memory usage patterns
  - **Stability**: API stability level (Most Stable, Stable, Experimental)

  ### Trade-offs Transparency

  Documentation now clearly explains the trade-offs for each preset:

  ```typescript
  // stable() - Most stable, blocks main thread
  // ✅ Most stable: Uses only standard JavaScript APIs
  // ✅ No worker communication overhead
  // ❌ Blocks main thread during parsing

  // responsive() - Non-blocking, stable
  // ✅ Non-blocking UI: Parsing runs in worker thread
  // ⚠️ Worker communication overhead

  // fast() - Fastest parse speed, blocks main thread
  // ✅ Fast parse speed: Compiled WASM code
  // ✅ No worker communication overhead
  // ❌ Blocks main thread
  // ❌ UTF-8 encoding only

  // responsiveFast() - Non-blocking + fast, stable
  // ✅ Non-blocking UI + fast parsing
  // ⚠️ Worker communication overhead
  // ❌ UTF-8 encoding only
  ```

  ## Migration Guide

  ### Quick Migration

  Replace old preset names with new names:

  1. **`mainThread()` → `stable()`** - If you need maximum stability
  2. **`worker()` → `responsive()`** - If you need non-blocking UI
  3. **`workerStreamTransfer()` → `memoryEfficient()`** - If you need memory efficiency
  4. **`wasm()` → `fast()`** - If you need fastest parse speed (and blocking is acceptable)
  5. **`workerWasm()` → `responsiveFast()`** - If you need non-blocking UI + fast parsing
  6. **`fastest()` → `responsiveFast()`** - Despite the name, this is the correct replacement
  7. **`strict()` → Remove** - Or use custom config with `strict: true`

  ### Choosing the Right Preset

  **By priority:**

  - **Stability first**: `stable()` - Most stable, uses only standard JavaScript APIs
  - **UI responsiveness first**: `responsive()` or `balanced()` - Non-blocking execution
  - **Parse speed first**: `fast()` - Fastest execution time (blocks main thread)
  - **General-purpose**: `balanced()` - Balanced performance characteristics

  **By use case:**

  - **Server-side parsing**: `stable()` or `fast()` - Blocking acceptable
  - **Browser with interactive UI**: `responsive()` or `balanced()` - Non-blocking required
  - **UTF-8 files only**: `fast()` or `responsiveFast()` - WASM acceleration
  - **Streaming large files**: `memoryEfficient()` or `balanced()` - Constant memory usage

  ### Example Migration

  **Before:**

  ```typescript
  import { parseString, EnginePresets } from "web-csv-toolbox";

  // Old: Unclear what "fastest" optimizes for
  for await (const record of parseString(csv, {
    engine: EnginePresets.fastest(),
  })) {
    console.log(record);
  }
  ```

  **After:**

  ```typescript
  import { parseString, EnginePresets } from "web-csv-toolbox";

  // New: Clear that this optimizes for UI responsiveness + parse speed
  for await (const record of parseString(csv, {
    engine: EnginePresets.responsiveFast(),
  })) {
    console.log(record);
  }
  ```

  ## Documentation Updates

  All documentation has been updated to reflect the new preset names and include detailed performance characteristics, trade-offs, and use case guidance.

  See the [Engine Presets Reference](https://github.com/kamiazya/web-csv-toolbox/blob/main/docs/reference/engine-presets.md) for complete documentation.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Add experimental performance tuning options to Engine configuration: `backpressureCheckInterval` and `queuingStrategy`

  ## New Experimental Features

  Added advanced performance tuning options for fine-grained control over streaming behavior:

  ### `engine.backpressureCheckInterval`

  Controls how frequently the internal parsers check for backpressure during streaming operations (count-based).

  **Default:**

  ```typescript
  {
    lexer: 100,      // Check every 100 tokens processed
    assembler: 10    // Check every 10 records processed
  }
  ```

  **Trade-offs:**

  - **Lower values**: More frequent backpressure checks, more responsive to downstream consumers
  - **Higher values**: Less frequent backpressure checks, reduced checking overhead

  **Potential Use Cases:**

  - Memory-constrained environments: Consider lower values for more responsive backpressure
  - Scenarios where checking overhead is a concern: Consider higher values
  - Slow consumers: Consider lower values to propagate backpressure more quickly

  ### `engine.queuingStrategy`

  Controls the internal queuing behavior of the CSV parser's streaming pipeline.

  **Default:** Designed to balance memory usage and buffering behavior

  **Structure:**

  ```typescript
  {
    lexerWritable?: QueuingStrategy<string>;
    lexerReadable?: QueuingStrategy<Token>;
    assemblerWritable?: QueuingStrategy<Token>;
    assemblerReadable?: QueuingStrategy<CSVRecord<any>>;
  }
  ```

  **Pipeline Stages:**
  The CSV parser uses a two-stage pipeline:

  1. **Lexer**: String → Token
  2. **Assembler**: Token → CSVRecord

  Each stage has both writable (input) and readable (output) sides:

  1. `lexerWritable` - Lexer input (string chunks)
  2. `lexerReadable` - Lexer output (tokens)
  3. `assemblerWritable` - Assembler input (tokens from lexer)
  4. `assemblerReadable` - Assembler output (CSV records)

  **Theoretical Trade-offs:**

  - **Small highWaterMark (1-10)**: Less memory for buffering, backpressure applied more quickly
  - **Medium highWaterMark (default)**: Balanced memory and buffering
  - **Large highWaterMark (100+)**: More memory for buffering, backpressure applied less frequently

  **Note:** Actual performance characteristics depend on your specific use case and runtime environment. Profile your application to determine optimal values.

  **Potential Use Cases:**

  - IoT/Embedded: Consider smaller highWaterMark for minimal memory footprint
  - Server-side batch processing: Consider larger highWaterMark for more buffering
  - Real-time streaming: Consider smaller highWaterMark for faster backpressure propagation

  ## Usage Examples

  ### Configuration Example: Tuning for Potential High-Throughput Scenarios

  ```typescript
  import { parseString, EnginePresets } from "web-csv-toolbox";

  const config = EnginePresets.fastest({
    backpressureCheckInterval: {
      lexer: 200, // Check every 200 tokens (less frequent)
      assembler: 20, // Check every 20 records (less frequent)
    },
    queuingStrategy: {
      lexerReadable: new CountQueuingStrategy({ highWaterMark: 100 }),
      assemblerReadable: new CountQueuingStrategy({ highWaterMark: 50 }),
    },
  });

  for await (const record of parseString(csv, { engine: config })) {
    console.log(record);
  }
  ```

  ### Memory-Constrained Environment

  ```typescript
  import { parseString, EnginePresets } from "web-csv-toolbox";

  const config = EnginePresets.balanced({
    backpressureCheckInterval: {
      lexer: 10, // Check every 10 tokens (frequent checks)
      assembler: 5, // Check every 5 records (frequent checks)
    },
    queuingStrategy: {
      // Minimal buffers throughout entire pipeline
      lexerWritable: new CountQueuingStrategy({ highWaterMark: 1 }),
      lexerReadable: new CountQueuingStrategy({ highWaterMark: 1 }),
      assemblerWritable: new CountQueuingStrategy({ highWaterMark: 1 }),
      assemblerReadable: new CountQueuingStrategy({ highWaterMark: 1 }),
    },
  });

  for await (const record of parseString(csv, { engine: config })) {
    console.log(record);
  }
  ```

  ## ⚠️ Experimental Status

  These APIs are marked as **experimental** and may change in future versions based on ongoing performance research. The default values are designed to work well for most use cases, but optimal values may vary depending on your specific environment and workload.

  **Recommendation:** Only adjust these settings if you're experiencing specific performance issues with large streaming operations or have specific memory/throughput requirements.

  ## Design Philosophy

  These options belong to `engine` configuration because they affect **performance and behavior only**, not the parsing result specification. This follows the design principle:

  - **Top-level options**: Affect specification (result changes)
  - **Engine options**: Affect performance/behavior (same result, different execution)

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - feat: introduce "slim" entry point for optimized bundle size

  This release introduces a new `slim` entry point that significantly reduces bundle size by excluding the inlined WebAssembly binary.

  ### New Entry Points

  The package now offers two distinct entry points:

  1.  **Main (`web-csv-toolbox`)**: The default entry point.

      - **Features:** Zero-configuration, works out of the box.
      - **Trade-off:** Includes the WASM binary inlined as base64 (~110KB), resulting in a larger bundle size.
      - **Best for:** Prototyping, quick starts, or when bundle size is not a critical constraint.

  2.  **Slim (`web-csv-toolbox/slim`)**: The new optimized entry point.
      - **Features:** Smaller bundle size, streaming WASM loading.
      - **Trade-off:** Requires manual initialization of the WASM binary.
      - **Best for:** Production applications where bundle size and load performance are critical.

  ### How to use the "Slim" version

  When using the slim version, you must manually load the WASM binary before using any WASM-dependent features (like `parseStringToArraySyncWASM` or high-performance parsing presets).

  ```typescript
  import { loadWASM, parseStringToArraySyncWASM } from "web-csv-toolbox/slim";
  // You need to provide the URL to the WASM file
  import wasmUrl from "web-csv-toolbox/csv.wasm?url";

  async function init() {
    // 1. Manually initialize WASM
    await loadWASM(wasmUrl);

    // 2. Now you can use WASM-powered functions
    const data = parseStringToArraySyncWASM("a,b,c\n1,2,3");
    console.log(data);
  }

  init();
  ```

  ### Worker Exports

  Corresponding worker exports are also available:

  - `web-csv-toolbox/worker` (Main)
  - `web-csv-toolbox/worker/slim` (Slim)

- [#603](https://github.com/kamiazya/web-csv-toolbox/pull/603) [`d03ad12`](https://github.com/kamiazya/web-csv-toolbox/commit/d03ad128fb9e0247adafe6a3e3c529fb6449dc5c) Thanks [@kamiazya](https://github.com/kamiazya)! - feat!: add Parser models and streams with improved architecture

  ## Summary

  This release introduces a new Parser layer that composes Lexer and Assembler components, providing a cleaner architecture and improved streaming support. The implementation follows the design patterns established by the recently developed CSVObjectRecordAssembler and CSVArrayRecordAssembler.

  ## New Features

  ### Parser Models

  #### FlexibleStringCSVParser

  - Composes `FlexibleStringCSVLexer` and CSV Record Assembler
  - Stateful parser for string CSV data
  - Supports both object and array output formats
  - Streaming mode support via `parse(chunk, { stream: true })`
  - Full options support (delimiter, quotation, columnCountStrategy, etc.)

  #### FlexibleBinaryCSVParser

  - Composes `TextDecoder` with `FlexibleStringCSVParser`
  - Accepts any BufferSource (Uint8Array, ArrayBuffer, or other TypedArray views)
  - Uses `TextDecoder` with `stream: true` option for proper streaming
  - Supports multiple character encodings (utf-8, shift_jis, etc.)
  - BOM handling via `ignoreBOM` option
  - Fatal error mode via `fatal` option

  #### Factory Functions

  - `createStringCSVParser()` - Creates FlexibleStringCSVParser instances
  - `createBinaryCSVParser()` - Creates FlexibleBinaryCSVParser instances

  ### Stream Classes

  #### StringCSVParserStream

  - `TransformStream<string, CSVRecord>` for streaming string parsing
  - Wraps Parser instances (not constructing internally)
  - Configurable backpressure handling
  - Custom queuing strategies support
  - Follows existing CSVLexerTransformer pattern

  #### BinaryCSVParserStream

  - `TransformStream<BufferSource, CSVRecord>` for streaming binary parsing
  - Accepts any BufferSource (Uint8Array, ArrayBuffer, or other TypedArray views)
  - Handles UTF-8 multi-byte characters across chunk boundaries
  - Integration-ready for fetch API and file streaming
  - Backpressure management with configurable check intervals

  ## Breaking Changes

  ### Object Format Behavior (Reverted)

  While initially explored, the final implementation **maintains the existing behavior**:

  - **Empty fields** (`,value,`): Filled with `""`
  - **Missing fields** (short rows): Remain as `undefined`

  This preserves backward compatibility and allows users to distinguish between explicitly empty fields and missing fields.

  ### Array Format Behavior (No Change)

  - **Empty fields**: Filled with `""`
  - **Missing fields** with `columnCountStrategy: 'pad'`: Filled with `undefined`

  ## Public API Exports (common.ts)

  Added exports for:

  - `FlexibleStringCSVParser`
  - `FlexibleBinaryCSVParser`
  - `createStringCSVParser`
  - `createBinaryCSVParser`
  - `StringCSVParserStream`
  - `BinaryCSVParserStream`

  ## Architecture Improvements

  ### Composition Over Implementation

  - Parsers compose Lexer + Assembler instead of reimplementing
  - Reduces code duplication across the codebase
  - Easier to maintain and extend

  ### Streaming Support

  - `TextDecoder` with `stream: true` for proper multi-byte character handling
  - Backpressure handling in Stream classes
  - Configurable check intervals for performance tuning

  ### Type Safety

  - Maintains full TypeScript strict mode compliance
  - Generic type parameters for header types
  - Proper CSVRecord type inference based on outputFormat

  ## Migration Guide

  ### For Users of Existing APIs

  No changes required. All existing functions (`parseString`, `parseBinary`, etc.) continue to work as before.

  ### For Direct Lexer/Assembler Users

  Consider migrating to Parser classes for simplified usage:

  ```typescript
  // Before (manual composition)
  const lexer = new FlexibleStringCSVLexer(options);
  const assembler = createCSVRecordAssembler(options);
  const tokens = lexer.lex(csv);
  const records = Array.from(assembler.assemble(tokens));

  // After (using Parser)
  const parser = new FlexibleStringCSVParser(options);
  const records = parser.parse(csv);
  ```

  ### For Stream Users

  New stream classes provide cleaner API:

  ```typescript
  // String streaming
  const parser = new FlexibleStringCSVParser({ header: ["name", "age"] });
  const stream = new StringCSVParserStream(parser);

  await fetch("data.csv")
    .then((res) => res.body)
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(stream)
    .pipeTo(yourProcessor);

  // Binary streaming
  const parser = new FlexibleBinaryCSVParser({ header: ["name", "age"] });
  const stream = new BinaryCSVParserStream(parser);

  await fetch("data.csv")
    .then((res) => res.body)
    .pipeThrough(stream)
    .pipeTo(yourProcessor);
  ```

  ## Performance Considerations

  - Backpressure check interval defaults to 100 records
  - Writable side: 64KB highWaterMark (byte/character counting)
  - Readable side: 256 records highWaterMark
  - Configurable via queuing strategies

  ## Documentation

  All new classes include comprehensive JSDoc documentation with:

  - Usage examples
  - Parameter descriptions
  - Return type documentation
  - Remarks on streaming behavior
  - Performance characteristics

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - feat!: add array output format support for CSV parsing

  CSV parsing results can now be returned as arrays in addition to objects, with TypeScript Named Tuple support for type-safe column access.

  ## New Features

  ### Array Output Format

  Parse CSV data into arrays instead of objects using the `outputFormat` option:

  ```typescript
  import { parseString } from "web-csv-toolbox";

  const csv = `name,age,city
  Alice,30,Tokyo
  Bob,25,Osaka`;

  // Array output (new)
  for await (const record of parseString(csv, { outputFormat: "array" })) {
    console.log(record); // ['Alice', '30', 'Tokyo']
    console.log(record[0]); // 'Alice' - type-safe access with Named Tuples
  }

  // Object output (default, unchanged)
  for await (const record of parseString(csv)) {
    console.log(record); // { name: 'Alice', age: '30', city: 'Tokyo' }
  }
  ```

  ### Named Tuple Type Support

  When headers are provided, array output uses TypeScript Named Tuples for type-safe access:

  ```typescript
  const csv = `name,age
  Alice,30`;

  for await (const record of parseString(csv, { outputFormat: "array" })) {
    // record type: { readonly [K in keyof ['name', 'age']]: string }
    // Equivalent to: { readonly 0: string, readonly 1: string, readonly length: 2 }
    console.log(record[0]); // Type-safe: 'Alice'
    console.log(record.length); // 2
  }
  ```

  ### Include Header Option

  Include the header row in the output (array format only):

  ```typescript
  for await (const record of parseString(csv, {
    outputFormat: "array",
    includeHeader: true,
  })) {
    console.log(record);
  }
  // ['name', 'age', 'city']  ← Header row
  // ['Alice', '30', 'Tokyo']
  // ['Bob', '25', 'Osaka']
  ```

  ### Column Count Strategy

  Control how mismatched column counts are handled (array format with header):

  ```typescript
  const csv = `name,age,city
  Alice,30        // Missing 'city'
  Bob,25,Osaka,JP // Extra column`;

  // Strategy: 'pad' - Pad short rows with undefined, truncate long rows
  for await (const record of parseString(csv, {
    outputFormat: "array",
    columnCountStrategy: "pad",
  })) {
    console.log(record);
  }
  // ['Alice', '30', undefined]
  // ['Bob', '25', 'Osaka']

  // Strategy: 'strict' - Throw error on mismatch
  // Strategy: 'truncate' - Truncate long rows, keep short rows as-is
  // Strategy: 'keep' - Keep all columns as-is (default)
  ```

  Available strategies:

  - `'keep'` (default): Return rows as-is, regardless of header length
  - `'pad'`: Pad short rows with `undefined`, truncate long rows to header length
  - `'strict'`: Throw `ParseError` if row length doesn't match header length
  - `'truncate'`: Truncate long rows to header length, keep short rows as-is

  ## Breaking Changes

  ### CSVRecordAssembler Interface Separation

  For better Rust/WASM implementation, the `CSVRecordAssembler` interface has been separated:

  - `CSVObjectRecordAssembler<Header>` - For object format output
  - `CSVArrayRecordAssembler<Header>` - For array format output

  The unified `CSVRecordAssembler<Header, Format>` type remains as a deprecated type alias for backward compatibility.

  **New specialized classes:**

  ```typescript
  import {
    FlexibleCSVObjectRecordAssembler,
    FlexibleCSVArrayRecordAssembler,
    createCSVRecordAssembler,
  } from "web-csv-toolbox";

  // Option 1: Factory function (recommended)
  const assembler = createCSVRecordAssembler({
    outputFormat: "array",
    includeHeader: true,
  });

  // Option 2: Specialized class for object output
  const objectAssembler = new FlexibleCSVObjectRecordAssembler({
    header: ["name", "age"],
  });

  // Option 3: Specialized class for array output
  const arrayAssembler = new FlexibleCSVArrayRecordAssembler({
    header: ["name", "age"],
    columnCountStrategy: "strict",
  });
  ```

  **Type structure:**

  ```typescript
  // Before
  type CSVRecordAssembler<Header, Format> = {
    assemble(tokens): IterableIterator<CSVRecord<Header, Format>>;
  };

  // After
  interface CSVObjectRecordAssembler<Header> {
    assemble(tokens): IterableIterator<CSVObjectRecord<Header>>;
  }

  interface CSVArrayRecordAssembler<Header> {
    assemble(tokens): IterableIterator<CSVArrayRecord<Header>>;
  }

  // Deprecated type alias (backward compatibility)
  type CSVRecordAssembler<Header, Format> = Format extends "array"
    ? CSVArrayRecordAssembler<Header>
    : CSVObjectRecordAssembler<Header>;
  ```

  ## Migration Guide

  ### For Most Users

  No changes required. All existing code continues to work:

  ```typescript
  // Existing code works without changes
  for await (const record of parseString(csv)) {
    console.log(record); // Still returns objects by default
  }
  ```

  ### Using New Array Output Format

  Simply add the `outputFormat` option:

  ```typescript
  // New: Array output
  for await (const record of parseString(csv, { outputFormat: "array" })) {
    console.log(record); // Returns arrays
  }
  ```

  ### For Advanced Users Using Low-Level APIs

  The existing `FlexibleCSVRecordAssembler` class continues to work. Optionally migrate to specialized classes:

  ```typescript
  // Option 1: Continue using FlexibleCSVRecordAssembler (no changes needed)
  const assembler = new FlexibleCSVRecordAssembler({ outputFormat: "array" });

  // Option 2: Use factory function (recommended)
  const assembler = createCSVRecordAssembler({ outputFormat: "array" });

  // Option 3: Use specialized classes directly
  const assembler = new FlexibleCSVArrayRecordAssembler({
    header: ["name", "age"],
    columnCountStrategy: "pad",
  });
  ```

  ## Use Cases

  ### Machine Learning / Data Science

  ```typescript
  // Easily convert CSV to training data arrays
  const features = [];
  for await (const record of parseString(csv, { outputFormat: "array" })) {
    features.push(record.map(Number));
  }
  ```

  ### Headerless CSV Files

  ```typescript
  const csv = `Alice,30,Tokyo
  Bob,25,Osaka`;

  for await (const record of parseString(csv, {
    outputFormat: "array",
    header: [], // Headerless
  })) {
    console.log(record); // ['Alice', '30', 'Tokyo']
  }
  ```

  ### Type-Safe Column Access

  ```typescript
  const csv = `name,age,city
  Alice,30,Tokyo`;

  for await (const record of parseString(csv, { outputFormat: "array" })) {
    // TypeScript knows the tuple structure
    const name: string = record[0]; // Type-safe
    const age: string = record[1]; // Type-safe
    const city: string = record[2]; // Type-safe
  }
  ```

  ## Benefits

  - **Memory efficiency**: Arrays use less memory than objects for large datasets
  - **Type safety**: Named Tuples provide compile-time type checking
  - **Flexibility**: Choose output format based on your use case
  - **Compatibility**: Easier integration with ML libraries and data processing pipelines
  - **Better Rust/WASM support**: Separated interfaces simplify native implementation

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - refactor!: rename core classes and simplify type system

  This release contains breaking changes for users of low-level APIs. Most users are not affected.

  ## Breaking Changes

  ### 1. Class Naming

  Low-level CSV processing classes have been renamed:

  ```diff
  - import { CSVLexer } from 'web-csv-toolbox';
  + import { FlexibleStringCSVLexer } from 'web-csv-toolbox';

  - const lexer = new CSVLexer(options);
  + const lexer = new FlexibleStringCSVLexer(options);
  ```

  For CSV record assembly, use the factory function or specialized classes:

  ```diff
  - import { CSVRecordAssembler } from 'web-csv-toolbox';
  + import { createCSVRecordAssembler, FlexibleCSVObjectRecordAssembler, FlexibleCSVArrayRecordAssembler } from 'web-csv-toolbox';

  - const assembler = new CSVRecordAssembler(options);
  + // Option 1: Use factory function (recommended)
  + const assembler = createCSVRecordAssembler({ outputFormat: 'object', ...options });
  +
  + // Option 2: Use specialized class directly
  + const assembler = new FlexibleCSVObjectRecordAssembler(options);
  ```

  ### 2. Type Renaming

  The `CSV` type has been renamed to `CSVData`:

  ```diff
  - import type { CSV } from 'web-csv-toolbox';
  + import type { CSVData } from 'web-csv-toolbox';

  - function processCSV(data: CSV) {
  + function processCSV(data: CSVData) {
      // ...
    }
  ```

  ## Bug Fixes

  - Fixed stream reader locks not being released when AbortSignal was triggered
  - Fixed Node.js WASM module loading
  - Improved error handling

  ## Migration Guide

  **For most users**: No changes required if you only use high-level functions like `parse()`, `parseString()`, `parseBlob()`, etc.

  **For advanced users** using low-level APIs:

  1. Rename `CSV` type to `CSVData`
  2. Rename `CSVLexer` to `FlexibleStringCSVLexer`
  3. Replace `CSVRecordAssembler` with `createCSVRecordAssembler()` factory function or specialized classes (`FlexibleCSVObjectRecordAssembler` / `FlexibleCSVArrayRecordAssembler`)

### Patch Changes

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Consolidate and enhance benchmark suite

  This changeset focuses on benchmark organization and expansion:

  **Benchmark Consolidation:**

  - Integrated 3 separate benchmark files (concurrent-performance.ts, queuing-strategy.bench.ts, worker-performance.ts) into main.ts
  - Unified benchmark suite now contains 57 comprehensive tests
  - Added conditional Worker support for Node.js vs browser environments

  **API Migration:**

  - Migrated from deprecated `{ execution: ['worker'] }` API to new EnginePresets API
  - Added tests for all engine presets: mainThread, wasm, worker, workerStreamTransfer, workerWasm, balanced, fastest, strict

  **Bottleneck Detection:**

  - Added 23 new benchmarks for systematic bottleneck detection:
    - Row count scaling (50-5000 rows)
    - Field length scaling (10 chars - 10KB)
    - Quote ratio impact (0%-100%)
    - Column count scaling (10-10,000 columns)
    - Line ending comparison (LF vs CRLF)
    - Engine comparison at different scales

  **Documentation Scenario Coverage:**

  - Added benchmarks for all scenarios mentioned in documentation
  - Included WASM performance tests
  - Added custom delimiter tests
  - Added parseStringStream tests
  - Added data transformation overhead tests

  **Key Findings:**

  - Column count is the most critical bottleneck (99.7% slower at 10k columns)
  - Field length has non-linear behavior at 1KB threshold
  - WASM advantage increases with data size (+18% → +32%)
  - Quote processing overhead is minimal (1.1-10% depending on scale)

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - fix: add charset validation to prevent malicious Content-Type header manipulation

  This patch addresses a security vulnerability where malicious or invalid charset values in Content-Type headers could cause parsing failures or unexpected behavior.

  **Changes:**

  - Fixed `parseMime` to handle Content-Type parameters without values (prevents `undefined.trim()` errors)
  - Added charset validation similar to existing compression validation pattern
  - Created `SUPPORTED_CHARSETS` constants for commonly used character encodings
  - Added `allowNonStandardCharsets` option to `BinaryOptions` for opt-in support of non-standard charsets
  - Added error handling in `convertBinaryToString` to catch TextDecoder instantiation failures
  - Charset values are now validated against a whitelist and normalized to lowercase

  **Security Impact:**

  - Invalid or malicious charset values are now rejected with clear error messages
  - Prevents DoS attacks via malformed Content-Type headers
  - Reduces risk of charset-based injection attacks

  **Breaking Changes:** None - existing valid charset values continue to work as before.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Add bundler integration guide for Workers and WebAssembly

  This release adds comprehensive documentation for using web-csv-toolbox with modern JavaScript bundlers (Vite, Webpack, Rollup) when using Worker-based or WebAssembly execution.

  **Package Structure Improvements:**

  - Moved worker files to root level for cleaner package exports
    - `src/execution/worker/helpers/worker.{node,web}.ts` → `src/worker.{node,web}.ts`
  - Added `./worker` export with environment-specific resolution (node/browser/default)
  - Added `./web_csv_toolbox_wasm_bg.wasm` export for explicit WASM file access
  - Updated internal relative paths in `createWorker.{node,web}.ts` to reflect new structure

  **New Documentation:**

  - **How-to Guide: Use with Bundlers** - Step-by-step configuration for Vite, Webpack, and Rollup

    - Worker configuration with `?url` imports
    - WASM configuration with explicit URL handling
    - WorkerPool reuse patterns
    - Common issues and troubleshooting

  - **Explanation: Package Exports** - Deep dive into environment detection mechanism

    - Conditional exports for node/browser environments
    - Worker implementation differences
    - Bundler compatibility

  - **Reference: Package Exports** - API reference for all package exports
    - Export paths and their resolutions
    - Conditional export conditions

  **Updated Documentation:**

  Added bundler usage notes to all Worker and WASM-related documentation:

  - `README.md`
  - `docs/explanation/execution-strategies.md`
  - `docs/explanation/worker-pool-architecture.md`
  - `docs/how-to-guides/choosing-the-right-api.md`
  - `docs/how-to-guides/wasm-performance-optimization.md`

  **Key Differences: Workers vs WASM with Bundlers**

  **Workers** 🟢:

  - Bundled automatically as data URLs using `?url` suffix
  - Works out of the box with Vite
  - Example: `import workerUrl from 'web-csv-toolbox/worker?url'`

  **WASM** 🟡:

  - Requires explicit URL configuration via `?url` import
  - Must call `loadWASM(wasmUrl)` before parsing
  - Example: `import wasmUrl from 'web-csv-toolbox/web_csv_toolbox_wasm_bg.wasm?url'`
  - Alternative: Copy WASM file to public directory

  **Migration Guide:**

  For users already using Workers with bundlers, no changes are required. The package now explicitly documents the `workerURL` option that was previously implicit.

  For new users, follow the bundler integration guide:

  ```typescript
  import { parseString, EnginePresets } from "web-csv-toolbox";
  import workerUrl from "web-csv-toolbox/worker?url"; // Vite

  for await (const record of parseString(csv, {
    engine: EnginePresets.worker({ workerURL: workerUrl }),
  })) {
    console.log(record);
  }
  ```

  **Breaking Changes:**

  None - this is purely additive documentation and package export improvements. Existing code continues to work without modifications.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor CI workflows to separate TypeScript and Rust environments

  This change improves CI efficiency by:

  - Splitting setup actions into setup-typescript, setup-rust, and setup-full
  - Separating WASM build and TypeScript build jobs with clear dependencies
  - Removing unnecessary tool installations from jobs that don't need them
  - Clarifying dependencies between TypeScript tests and WASM artifacts

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - chore: eliminate circular dependencies and improve code quality

  This patch improves the internal code structure by eliminating all circular dependencies and adding tooling to prevent future issues.

  **Changes:**

  - Introduced `madge` for circular dependency detection and visualization
  - Eliminated circular dependencies:
    - `common/types.ts` ⇄ `utils/types.ts`: Merged type definitions into `common/types.ts`
    - `parseFile.ts` ⇄ `parseFileToArray.ts`: Refactored to use direct dependencies
  - Fixed import paths in test files to consistently use `.ts` extension
  - Added npm scripts for dependency analysis:
    - `check:circular`: Detect circular dependencies
    - `graph:main`: Visualize main entry point dependencies
    - `graph:worker`: Visualize worker entry point dependencies
    - `graph:json`, `graph:summary`, `graph:orphans`, `graph:leaves`: Various analysis tools
  - Added circular dependency check to CI pipeline (`.github/workflows/.build.yaml`)
  - Updated `.gitignore` to exclude generated dependency graph files

  **Impact:**

  - No runtime behavior changes
  - Better maintainability and code structure
  - Faster build times due to cleaner dependency graph
  - Automated prevention of circular dependency introduction

  **Breaking Changes:** None - this is purely an internal refactoring with no API changes.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - docs: comprehensive documentation update and new examples

  This release brings significant improvements to the documentation and examples, making it easier to get started and use advanced features.

  ## New Examples

  Added comprehensive example projects for various environments and bundlers:

  - **Deno**: `examples/deno-main`, `examples/deno-slim`
  - **Node.js**: `examples/node-main`, `examples/node-slim`, `examples/node-worker-main`
  - **Vite**: `examples/vite-bundle-main`, `examples/vite-bundle-slim`, `examples/vite-bundle-worker-main`, `examples/vite-bundle-worker-slim`
  - **Webpack**: `examples/webpack-bundle-worker-main`, `examples/webpack-bundle-worker-slim`

  These examples demonstrate:

  - How to use the new `slim` entry point
  - Worker integration with different bundlers
  - Configuration for Vite and Webpack
  - TypeScript setup

  ## Documentation Improvements

  - **Engine Presets**: Detailed guide on choosing the right engine preset for your use case
  - **Main vs Slim**: Explanation of the trade-offs between the main (auto-init) and slim (manual-init) entry points
  - **WASM Architecture**: Updated architecture documentation reflecting the new module structure
  - **Performance Guide**: Improved guide on optimizing performance with WASM and Workers

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Expand browser testing coverage and improve documentation

  **Testing Infrastructure Improvements:**

  - **macOS Browser Testing**: Added Chrome and Firefox testing on macOS in CI/CD
    - Vitest 4 stable browser mode enabled headless testing on macOS
    - Previously blocked due to Safari headless limitations
  - **Parallel Browser Execution**: Multiple browsers now run in parallel within each OS job
    - Linux: Chrome + Firefox in parallel
    - macOS: Chrome + Firefox in parallel
    - Windows: Chrome + Firefox + Edge in parallel
  - **Dynamic Browser Configuration**: Browser instances automatically determined by platform
    - Uses `process.platform` to select appropriate browsers
    - Eliminates need for environment variables
  - **Explicit Browser Project Targeting**: Updated `test:browser` script to explicitly run only browser tests
    - Added `--project browser` flag to prevent running Node.js tests during browser test execution
    - Ensures CI jobs run only their intended test suites

  **Documentation Improvements:**

  - **Quick Overview Section**: Added comprehensive support matrix and metrics
    - Visual support matrix showing all environment/platform combinations
    - Tier summary with coverage statistics
    - Testing coverage breakdown by category
    - Clear legend explaining all support status icons
  - **Clearer Support Tiers**: Improved distinction between support levels
    - ✅ Full Support (Tier 1): Tested and officially supported
    - 🟡 Active Support (Tier 2): Limited testing, active maintenance
    - 🔵 Community Support (Tier 3): Not tested, best-effort support
  - **Cross-Platform Runtime Support**: Clarified Node.js and Deno support across all platforms
    - Node.js LTS: Tier 1 support on Linux, macOS, and Windows
    - Deno LTS: Tier 2 support on Linux, macOS, and Windows
    - Testing performed on Linux only due to cross-platform runtime design
    - Eliminates unnecessary concern about untested platforms
  - **Simplified Tables**: Converted redundant tables to concise bullet lists
    - Removed repetitive "Full Support" entries
    - Easier to scan and understand

  **Browser Testing Coverage:**

  - Chrome: Tested on Linux, macOS, and Windows (Tier 1)
  - Firefox: Tested on Linux, macOS, and Windows (Tier 1)
  - Edge: Tested on Windows only (Tier 1)
  - Safari: Community support (headless mode not supported by Vitest)

  **Breaking Changes:**

  None - this release only improves testing infrastructure and documentation.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Add regression tests and documentation for prototype pollution safety

  This changeset adds comprehensive tests and documentation to ensure that CSVRecordAssembler does not cause prototype pollution when processing CSV headers with dangerous property names.

  **Security Verification:**

  - Verified that `Object.fromEntries()` is safe from prototype pollution attacks
  - Confirmed that dangerous property names (`__proto__`, `constructor`, `prototype`) are handled safely
  - Added 8 comprehensive regression tests in `FlexibleCSVRecordAssembler.prototype-safety.test.ts`

  **Test Coverage:**

  - Tests with `__proto__` as CSV header
  - Tests with `constructor` as CSV header
  - Tests with `prototype` as CSV header
  - Tests with multiple dangerous property names
  - Tests with multiple records
  - Tests with quoted fields
  - Baseline tests documenting `Object.fromEntries()` behavior

  **Documentation:**

  - Added detailed safety comments to all `Object.fromEntries()` usage in CSVRecordAssembler
  - Documented why the implementation is safe from prototype pollution
  - Added references to regression tests for verification

  **Conclusion:**
  The AI security report suggesting prototype pollution vulnerability was a false positive. `Object.fromEntries()` creates own properties (not prototype properties), making it inherently safe from prototype pollution attacks. This changeset provides regression tests to prevent future concerns and documents the safety guarantees.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve Rust/WASM development environment and add comprehensive tests

  ## Internal Improvements

  - Migrated from Homebrew Rust to rustup for better toolchain management
  - Updated Rust dependencies to latest versions (csv 1.4, wasm-bindgen 0.2.105, serde 1.0.228)
  - Added 10 comprehensive unit tests for CSV parsing functionality
  - Added Criterion-based benchmarks for performance tracking
  - Improved error handling in WASM bindings
  - Configured rust-analyzer and development tools (rustfmt, clippy)
  - Added `pkg/` directory to `.gitignore` (build artifacts should not be tracked)
  - Added Rust tests to CI pipeline (GitHub Actions Dynamic Tests workflow)
  - Integrated Rust coverage with Codecov (separate from TypeScript with `rust` flag)
  - Integrated Rust benchmarks with CodSpeed for performance regression detection

  These changes improve code quality and maintainability without affecting the public API or functionality.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - chore: upgrade Biome to 2.3.4 and update configuration

  Upgraded development dependency @biomejs/biome from 1.9.4 to 2.3.4 and updated configuration for compatibility with Biome v2. This change has no impact on the runtime behavior or public API.

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - chore: upgrade TypeScript to 5.9.3 and typedoc to 0.28.14 with enhanced documentation

  **Developer Experience Improvements:**

  - Upgraded TypeScript from 5.8.3 to 5.9.3
  - Upgraded typedoc from 0.28.5 to 0.28.14
  - Enabled strict type checking options (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
  - Enhanced TypeDoc configuration with version display, improved sorting, and navigation
  - Integrated all documentation markdown files with TypeDoc using native `projectDocuments` support
  - Added YAML frontmatter to all documentation files for better organization

  **Type Safety Enhancements:**

  - Added explicit `| undefined` to all optional properties for stricter type checking
  - Added proper undefined checks for array/object indexed access
  - Improved TextDecoderOptions usage to avoid explicit undefined values

  **Documentation Improvements:**

  - Enhanced TypeDoc navigation with categories, groups, and folders
  - Added sidebar and navigation links to GitHub and npm
  - Organized documentation into Tutorials, How-to Guides, Explanation, and Reference sections
  - Improved documentation discoverability with YAML frontmatter grouping

  **Breaking Changes:** None - all changes are backward compatible

- [#601](https://github.com/kamiazya/web-csv-toolbox/pull/601) [`9fc9471`](https://github.com/kamiazya/web-csv-toolbox/commit/9fc947173e2a43af716f581716472d7a331479b5) Thanks [@kamiazya](https://github.com/kamiazya)! - feat(wasm): add input size validation and source option for error reporting

  This patch enhances the WASM CSV parser with security improvements and better error reporting capabilities.

  **Security Enhancements:**

  - **Input Size Validation**: Added validation to prevent memory exhaustion attacks
    - Validates CSV input size against `maxBufferSize` parameter before processing
    - Returns clear error message when size limit is exceeded
    - Default limit: 10MB (configurable via TypeScript options)
    - Addresses potential DoS vulnerability from maliciously large CSV inputs

  **Error Reporting Improvements:**

  - **Source Option**: Added optional `source` parameter for better error context
    - Allows specifying a source identifier (e.g., filename) in error messages
    - Error format: `"Error message in \"filename\""`
    - Significantly improves debugging when processing multiple CSV files
    - Aligns with TypeScript implementation's `CommonOptions.source`

  **Performance Optimizations:**

  - Optimized `format_error()` to take ownership of String
    - Avoids unnecessary allocation when source is None
    - Improves error path performance by eliminating `to_string()` call
    - Zero-cost abstraction in the common case (no source identifier)

  **Code Quality Improvements:**

  - Used `bool::then_some()` for more idiomatic Option handling
  - Fixed Clippy `needless_borrow` warnings in tests
  - Applied cargo fmt formatting for consistency

  **Implementation Details:**

  Rust (`web-csv-toolbox-wasm/src/lib.rs`):

  - Added `format_error()` helper function for consistent error formatting
  - Updated `parse_csv_to_json()` to accept `max_buffer_size` and `source` parameters
  - Implemented input size validation at parse entry point
  - Applied source context to all error types (headers, records, JSON serialization)

  TypeScript (`src/parseStringToArraySyncWASM.ts`):

  - Updated to pass `maxBufferSize` from options to WASM function
  - Updated to pass `source` from options to WASM function

  **Breaking Changes:** None - this is a backward-compatible enhancement with sensible defaults.

  **Migration:** No action required. Existing code continues to work without modification.

## 0.13.0

### Minor Changes

- [#545](https://github.com/kamiazya/web-csv-toolbox/pull/545) [`43a6812`](https://github.com/kamiazya/web-csv-toolbox/commit/43a68127cfe4433ac3c4542933b22f7acbcd93be) Thanks [@kamiazya](https://github.com/kamiazya)! - Add comprehensive memory protection to prevent memory exhaustion attacks

  This release introduces new security features to prevent unbounded memory growth during CSV parsing. The parser now enforces configurable limits on both buffer size and field count to protect against denial-of-service attacks via malformed or malicious CSV data.

  **New Features:**

  - Added `maxBufferSize` option to `CommonOptions` (default: `10 * 1024 * 1024` characters)
  - Added `maxFieldCount` option to `RecordAssemblerOptions` (default: 100,000 fields)
  - Throws `RangeError` when buffer exceeds size limit
  - Throws `RangeError` when field count exceeds limit
  - Comprehensive memory safety protection against DoS attacks

  **Note:** `maxBufferSize` is measured in UTF-16 code units (JavaScript string length), not bytes. This is approximately 10MB for ASCII text, but may vary for non-ASCII characters.

  **Breaking Changes:**
  None. This is a backward-compatible enhancement with sensible defaults.

  **Security:**
  This change addresses three potential security vulnerabilities:

  1. **Unbounded buffer growth via streaming input**: Attackers could exhaust system memory by streaming large amounts of malformed CSV data that cannot be tokenized. The `maxBufferSize` limit prevents this by throwing `RangeError` when the internal buffer exceeds `10 * 1024 * 1024` characters (approximately 10MB for ASCII).

  2. **Quoted field parsing memory exhaustion**: Attackers could exploit the quoted field parsing logic by sending strategically crafted CSV with unclosed quotes or excessive escaped quotes, causing the parser to accumulate unbounded data in the buffer. The `maxBufferSize` limit protects against this attack vector.

  3. **Excessive column count attacks**: Attackers could send CSV files with an enormous number of columns to exhaust memory during header parsing and record assembly. The `maxFieldCount` limit (default: 100,000 fields per record) prevents this by throwing `RangeError` when exceeded.

  Users processing untrusted CSV input are encouraged to use the default limits or configure appropriate `maxBufferSize` and `maxFieldCount` values for their use case.

- [#546](https://github.com/kamiazya/web-csv-toolbox/pull/546) [`76eec90`](https://github.com/kamiazya/web-csv-toolbox/commit/76eec9027400dc77264be2be8a252d284f00dc6a) Thanks [@kamiazya](https://github.com/kamiazya)! - **BREAKING CHANGE**: Change error types from RangeError to TypeError for consistency with Web Standards

  - Change all `RangeError` to `TypeError` for consistency
  - This affects error handling in:
    - `getOptionsFromResponse()`: Invalid MIME type, unsupported/multiple content-encodings
    - `parseResponse()`: Null response body
    - `parseResponseToStream()`: Null response body
  - Aligns with Web Standard APIs behavior (DecompressionStream throws TypeError)
  - Improves consistency for error handling with `catch (error instanceof TypeError)`

  **Migration guide:**
  If you were catching `RangeError` from `getOptionsFromResponse()`, update to catch `TypeError` instead:

  ```diff
  - } catch (error) {
  -   if (error instanceof RangeError) {
  + } catch (error) {
  +   if (error instanceof TypeError) {
        // Handle invalid content type or encoding
      }
    }
  ```

  ### New feature: Experimental compression format support

  - Add `allowExperimentalCompressions` option to enable experimental/non-standard compression formats
  - **Browsers**: By default, only `gzip` and `deflate` are supported (cross-browser compatible)
  - **Node.js**: By default, `gzip`, `deflate`, and `br` (Brotli) are supported
  - When enabled, allows platform-specific formats like `deflate-raw` (Chrome/Edge only)
  - Provides flexibility for environment-specific compression formats
  - See documentation for browser compatibility details and usage examples

  **Other improvements in this release:**

  - Add Content-Encoding header validation with RFC 7231 compliance
  - Normalize Content-Encoding header: convert to lowercase, trim whitespace
  - Ignore empty or whitespace-only Content-Encoding headers
  - Add comprehensive tests for Content-Encoding validation (23 tests)
  - Add security documentation with TransformStream size limit example
  - Error messages now guide users to `allowExperimentalCompressions` option when needed

- [#551](https://github.com/kamiazya/web-csv-toolbox/pull/551) [`b21b6d8`](https://github.com/kamiazya/web-csv-toolbox/commit/b21b6d89a7a3f18dcbf79ec04ffefde0d7ff4c4c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add comprehensive documentation for supported environments and versioning policy

  This release adds two new reference documents to clarify the library's support policies and version management strategy.

  **New Documentation:**

  - **[Supported Environments](./docs/reference/supported-environments.md)**: Comprehensive documentation of runtime environment support tiers
  - **[Versioning Policy](./docs/reference/versioning-policy.md)**: Detailed versioning strategy and semantic versioning rules

- [#551](https://github.com/kamiazya/web-csv-toolbox/pull/551) [`b21b6d8`](https://github.com/kamiazya/web-csv-toolbox/commit/b21b6d89a7a3f18dcbf79ec04ffefde0d7ff4c4c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add environment-specific compression format support for better cross-browser and Node.js compatibility

  This release adjusts the supported compression formats based on the runtime environment to ensure reliability and prevent errors across different browsers and Node.js versions.

  **Changes:**

  - **Browser environments**: Support `gzip` and `deflate` only (universal cross-browser support)
  - **Node.js 20+ environments**: Support `gzip`, `deflate`, and `br` (Brotli)

  **Rationale:**

  Previously, browser builds included `deflate-raw` in the default supported formats. However, `deflate-raw` is only supported in Chromium-based browsers (Chrome, Edge) and not in Firefox or Safari. To ensure the library works reliably across all modern browsers by default, we now only include universally supported formats.

  **Browser Compatibility:**

  | Format        | Chrome/Edge | Firefox | Safari | Included by Default  |
  | ------------- | ----------- | ------- | ------ | -------------------- |
  | `gzip`        | ✅          | ✅      | ✅     | ✅ Yes               |
  | `deflate`     | ✅          | ✅      | ✅     | ✅ Yes               |
  | `deflate-raw` | ✅          | ❌      | ❌     | ❌ No (experimental) |

  **Using Experimental Compressions:**

  If you need to use `deflate-raw` or other non-standard compression formats in Chromium-based browsers, you can enable them with the `allowExperimentalCompressions` option:

  ```typescript
  // Use deflate-raw in Chrome/Edge (may fail in Firefox/Safari)
  const response = await fetch("data.csv"); // Content-Encoding: deflate-raw
  await parseResponse(response, {
    allowExperimentalCompressions: true,
  });
  ```

  You can also detect browser support at runtime:

  ```typescript
  // Browser-aware usage
  const isChromium = navigator.userAgent.includes("Chrome");
  await parseResponse(response, {
    allowExperimentalCompressions: isChromium,
  });
  ```

  **Migration Guide:**

  For users who were relying on `deflate-raw` in browser environments:

  1. **Option 1**: Use `gzip` or `deflate` compression instead (recommended for cross-browser compatibility)

     ```typescript
     // Server-side: Use gzip instead of deflate-raw
     response.headers.set("content-encoding", "gzip");
     ```

  2. **Option 2**: Enable experimental compressions for Chromium-only deployments

     ```typescript
     await parseResponse(response, {
       allowExperimentalCompressions: true,
     });
     // Works in Chrome/Edge, may fail in Firefox/Safari
     ```

  3. **Option 3**: Detect browser support and handle fallbacks
     ```typescript
     try {
       await parseResponse(response, {
         allowExperimentalCompressions: true,
       });
     } catch (error) {
       // Fallback for browsers that don't support the format
       console.warn("Compression format not supported, using uncompressed");
     }
     ```

  **Implementation:**

  The supported compressions are now determined at build time using package.json `imports` field:

  - Browser/Web builds use `getOptionsFromResponse.constants.web.js`
  - Node.js builds use `getOptionsFromResponse.constants.node.js`

  This ensures type-safe, environment-appropriate compression support.

  **No changes required** for users already using `gzip` or `deflate` compression in browsers, or `gzip`, `deflate`, or `br` in Node.js.

- [#563](https://github.com/kamiazya/web-csv-toolbox/pull/563) [`7d51d52`](https://github.com/kamiazya/web-csv-toolbox/commit/7d51d5285be9cffa5103de58469d8de0c98959d7) Thanks [@kamiazya](https://github.com/kamiazya)! - Optimize streaming API design for better performance and consistency

  ## Breaking Changes

  ### Token Stream Output Changed from Batch to Individual

  `CSVLexerTransformer` and `CSVRecordAssemblerTransformer` now emit/accept individual tokens instead of token arrays for improved streaming performance and API consistency.

  **Before:**

  ```typescript
  CSVLexerTransformer: TransformStream<string, Token[]>;
  CSVRecordAssemblerTransformer: TransformStream<Token[], CSVRecord>;
  ```

  **After:**

  ```typescript
  CSVLexerTransformer: TransformStream<string, Token>;
  CSVRecordAssemblerTransformer: TransformStream<Token, CSVRecord>;
  ```

  ### Why This Change?

  1. **Consistent API Design**: RecordAssembler already emits individual records. Lexer now matches this pattern.
  2. **Better Backpressure**: Fine-grained token-by-token flow control instead of batch-based.
  3. **Memory Efficiency**: Eliminates temporary token array allocation.
  4. **Simpler Queuing Strategy**: Uniform `size: () => 1` across the pipeline.

  ### Migration Guide

  **For Low-Level API Users:**

  If you directly use `CSVLexerTransformer` or `CSVRecordAssemblerTransformer`:

  ```typescript
  // Before: Process token arrays
  stream.pipeThrough(new CSVLexerTransformer()).pipeTo(
    new WritableStream({
      write(tokens) {
        // tokens is Token[]
        for (const token of tokens) {
          console.log(token);
        }
      },
    })
  );

  // After: Process individual tokens
  stream.pipeThrough(new CSVLexerTransformer()).pipeTo(
    new WritableStream({
      write(token) {
        // token is Token
        console.log(token);
      },
    })
  );
  ```

  **For High-Level API Users:**

  No changes required. Functions like `parseString()`, `parseStringStream()`, etc. continue to work without modification.

  ## Performance Improvements

  ### CSVRecordAssembler Now Accepts Single Tokens

  `CSVRecordAssembler.assemble()` has been optimized to accept both single `Token` and `Iterable<Token>`, eliminating unnecessary array allocation in streaming scenarios.

  **Before:**

  ```typescript
  // Had to wrap single tokens in an array
  for (const token of tokens) {
    const records = assembler.assemble([token], { stream: true }); // Array allocation
  }
  ```

  **After:**

  ```typescript
  // Pass single tokens directly (backward compatible)
  for (const token of tokens) {
    const records = assembler.assemble(token, { stream: true }); // No array allocation
  }

  // Iterable still works
  const records = assembler.assemble(tokens, { stream: true });
  ```

  **Benefits:**

  - Zero-allocation token processing in streaming mode
  - Better memory efficiency for large CSV files
  - Backward compatible - existing code continues to work
  - Aligns with Web Standards (TextDecoder pattern)

  **Implementation Details:**

  - Uses lightweight `Symbol.iterator` check to detect iterables
  - Internal refactoring with private `#processToken()` and `#flush()` methods
  - Maintains single public method (`assemble`) following TextDecoder pattern

  ## New Feature: Configurable Queuing Strategies

  Both `CSVLexerTransformer` and `CSVRecordAssemblerTransformer` now support custom queuing strategies following the Web Streams API pattern. Strategies are passed as constructor arguments, similar to the standard `TransformStream`.

  ## API Changes

  ### Constructor Signature

  Queuing strategies are now passed as separate constructor arguments:

  ```typescript
  // Before (if this was previously supported - this is a new feature)
  new CSVLexerTransformer(options)

  // After
  new CSVLexerTransformer(options?, writableStrategy?, readableStrategy?)
  new CSVRecordAssemblerTransformer(options?, writableStrategy?, readableStrategy?)
  ```

  ### CSVLexerTransformer

  - **Parameter 1** `options`: CSV-specific options (delimiter, quotation, etc.)
  - **Parameter 2** `writableStrategy`: Controls buffering for incoming string chunks
    - Default: `{ highWaterMark: 65536, size: (chunk) => chunk.length }`
    - Counts by **character count** (string length)
    - Default allows ~64KB of characters
  - **Parameter 3** `readableStrategy`: Controls buffering for outgoing tokens
    - Default: `{ highWaterMark: 1024, size: () => 1 }`
    - Counts each **token as 1**
    - Default allows 1024 tokens

  ### CSVRecordAssemblerTransformer

  - **Parameter 1** `options`: CSV-specific options (header, maxFieldCount, etc.)
  - **Parameter 2** `writableStrategy`: Controls buffering for incoming tokens
    - Default: `{ highWaterMark: 1024, size: () => 1 }`
    - Counts each **token as 1**
    - Default allows 1024 tokens
  - **Parameter 3** `readableStrategy`: Controls buffering for outgoing CSV records
    - Default: `{ highWaterMark: 256, size: () => 1 }`
    - Counts each **record as 1**
    - Default allows 256 records

  ## Default Values Rationale

  **Important**: The default values are **theoretical starting points** based on data flow characteristics, **not empirical benchmarks**.

  ### Size Counting Strategy

  Each transformer uses a **simple and consistent size algorithm**:

  - **CSVLexerTransformer writable**: Counts by **string length** (characters). This provides accurate backpressure based on actual data volume.
  - **CSVLexerTransformer readable**: Counts **each token as 1**. Simple and consistent with downstream.
  - **CSVRecordAssemblerTransformer writable**: Counts **each token as 1**. Matches the lexer's readable side for smooth pipeline flow.
  - **CSVRecordAssemblerTransformer readable**: Counts **each record as 1**. Simple and effective for record-based backpressure.

  ### Why These Defaults?

  - **Uniform counting**: Token and record stages all use `size: () => 1` for simplicity
  - **Character-based input**: Only the initial string input uses character counting for predictable memory usage
  - **Predictable pipeline**: Consistent token-by-token and record-by-record flow throughout
  - **Natural backpressure**: Fine-grained control allows responsive backpressure handling

  ### Backpressure Handling

  Both transformers implement **cooperative backpressure handling** with configurable check intervals:

  - Periodically checks `controller.desiredSize` during processing
  - When backpressure is detected (`desiredSize ≤ 0`), yields to the event loop via `setTimeout(0)`
  - Prevents blocking the main thread during heavy CSV processing
  - Allows downstream consumers to catch up, avoiding memory buildup

  **Configurable Check Interval:**

  - Set via `checkInterval` property in `ExtendedQueuingStrategy`
  - Lower values = more responsive but slight overhead
  - Higher values = less overhead but slower response
  - Defaults: 100 tokens (lexer), 10 records (assembler)

  This is especially important for:

  - Large CSV files that generate many tokens/records
  - Slow downstream consumers (e.g., database writes, API calls)
  - Browser environments where UI responsiveness is critical

  Optimal values depend on your runtime environment (browser/Node.js/Deno), data size, memory constraints, and CPU performance. **You should profile your specific use case** to find the best values.

  ## Benchmarking Tool

  A benchmark tool is provided to help you find optimal values for your use case:

  ```bash
  pnpm --filter web-csv-toolbox-benchmark queuing-strategy
  ```

  See `benchmark/queuing-strategy.bench.ts` for details.

  ## Usage Examples

  ```typescript
  import {
    CSVLexerTransformer,
    CSVRecordAssemblerTransformer,
  } from "web-csv-toolbox";

  // Basic usage (with defaults)
  const lexer = new CSVLexerTransformer();

  // Custom strategies based on YOUR profiling results
  const lexer = new CSVLexerTransformer(
    { delimiter: "," },
    {
      highWaterMark: 131072, // 128KB of characters
      size: (chunk) => chunk.length, // Count by character length
      checkInterval: 200, // Check backpressure every 200 tokens
    },
    {
      highWaterMark: 2048, // 2048 tokens
      size: () => 1, // Each token counts as 1
      checkInterval: 50, // Check backpressure every 50 tokens
    }
  );

  const assembler = new CSVRecordAssemblerTransformer(
    {},
    {
      highWaterMark: 2048, // 2048 tokens
      size: () => 1, // Each token counts as 1
      checkInterval: 20, // Check backpressure every 20 records
    },
    {
      highWaterMark: 512, // 512 records
      size: () => 1, // Each record counts as 1
      checkInterval: 5, // Check backpressure every 5 records
    }
  );
  ```

  ## When to Customize

  - **High-throughput servers**: Try higher values (e.g., 32-64) and benchmark
  - **Memory-constrained environments** (browsers, edge functions): Try lower values (e.g., 1-4) and monitor memory
  - **Custom pipelines**: Profile with representative data and iterate

  ## Web Standards Compliance

  This API follows the Web Streams API pattern where `TransformStream` accepts queuing strategies as constructor arguments, making it consistent with standard web platform APIs.

- [#562](https://github.com/kamiazya/web-csv-toolbox/pull/562) [`bd865d6`](https://github.com/kamiazya/web-csv-toolbox/commit/bd865d6ddb1cf9691d7b9a83d0790651f074dd47) Thanks [@kamiazya](https://github.com/kamiazya)! - **BREAKING CHANGE**: Refactor low-level API to align with Web Standards (TextDecoder pattern)

  This release introduces breaking changes to make the API more consistent with Web Standard APIs like `TextDecoder`.

  ## Class Renames

  All core classes have been renamed with `CSV` prefix for clarity:

  - `Lexer` → `CSVLexer`
  - `RecordAssembler` → `CSVRecordAssembler`
  - `LexerTransformer` → `CSVLexerTransformer`
  - `RecordAssemblerTransformer` → `CSVRecordAssemblerTransformer`

  ## API Changes

  The streaming API now follows the `TextDecoder` pattern using `options.stream` instead of positional boolean parameters:

  ### CSVLexer

  ```ts
  // Before
  lexer.lex(chunk, true); // buffering mode
  lexer.flush(); // flush remaining data

  // After
  lexer.lex(chunk, { stream: true }); // streaming mode
  lexer.lex(); // flush remaining data
  ```

  ### CSVRecordAssembler

  ```ts
  // Before
  assembler.assemble(tokens, false); // don't flush
  assembler.flush(); // flush remaining data

  // After
  assembler.assemble(tokens, { stream: true }); // streaming mode
  assembler.assemble(); // flush remaining data
  ```

  ## Removed Methods

  - `CSVLexer.flush()` - Use `lex()` without arguments instead
  - `CSVRecordAssembler.flush()` - Use `assemble()` without arguments instead

  ## Migration Guide

  1. Update class names: Add `CSV` prefix to `Lexer`, `RecordAssembler`, `LexerTransformer`, and `RecordAssemblerTransformer`
  2. Replace `lex(chunk, buffering)` with `lex(chunk, { stream: !buffering })`
  3. Replace `assemble(tokens, flush)` with `assemble(tokens, { stream: !flush })`
  4. Replace `flush()` calls with parameter-less `lex()` or `assemble()` calls

- [#551](https://github.com/kamiazya/web-csv-toolbox/pull/551) [`b21b6d8`](https://github.com/kamiazya/web-csv-toolbox/commit/b21b6d89a7a3f18dcbf79ec04ffefde0d7ff4c4c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add experimental worker thread execution support for CSV parsing

  This release introduces experimental worker thread execution support, enabling CSV parsing to be offloaded to a separate thread. This keeps the main thread responsive, particularly beneficial for large CSV files in browser environments.

  **New Features:**

  - Added `engine` configuration object to all parsing functions (`parseString`, `parseBinary`, `parseStringStream`, `parseUint8ArrayStream`, `parseResponse`)
  - Support for `engine: { worker: true }` to run parsing in a Web Worker (browser) or Worker Thread (Node.js)
  - Support for `engine: { wasm: true }` to use WebAssembly for high-performance parsing
  - Support for `engine: { worker: true, wasm: true }` to combine both strategies
  - Cross-platform worker support for browsers, Node.js (20+), and Deno
  - Automatic worker strategy selection: Transferable Streams (Chrome/Firefox/Edge) or Message Streaming (Safari/fallback)
  - Concurrent request handling: WorkerPool manages multiple CSV parsing requests efficiently

  **Implementation Details:**

  - **Execution Routing Layer**: Dynamic imports route parsing to appropriate execution strategy (main thread, worker, or WASM)
  - **Cross-Platform Compatibility**:
    - Browsers: Web Workers with Transferable Streams (zero-copy)
    - Node.js: Worker Threads with message passing
    - Deno: Web Workers API
  - **Worker Context Abstraction**: Unified message handling across `self` (Web Workers) and `parentPort` (Node.js Worker Threads)
  - **Smart Stream Handling**:
    - Browser: Transfer ReadableStream directly to worker
    - Node.js: Collect stream data first, then transfer to worker

  **API Usage:**

  ```typescript
  import { parseString } from "web-csv-toolbox";

  // Parse in main thread (default)
  for await (const record of parseString(csv)) {
    console.log(record);
  }

  // Parse in worker thread (experimental)
  for await (const record of parseString(csv, { engine: { worker: true } })) {
    console.log(record);
  }

  // Parse with WASM (experimental)
  for await (const record of parseString(csv, { engine: { wasm: true } })) {
    console.log(record);
  }

  // Parse with both Worker and WASM (experimental)
  for await (const record of parseString(csv, {
    engine: { worker: true, wasm: true },
  })) {
    console.log(record);
  }
  ```

  **Performance Considerations:**

  - Worker initialization has overhead (~5-20ms depending on environment)
  - Best suited for:
    - Large CSV files (>1000 rows)
    - Maintaining UI responsiveness during parsing
    - Processing multiple CSVs concurrently
  - For small CSV files (<100 rows), main thread execution is typically faster

  **Known Limitations:**

  - Engine configuration is experimental and subject to change
  - Safari does not support Transferable Streams (automatically falls back to Message Streaming)
  - WASM only supports UTF-8 encoding and double-quote (`"`) as quotation character

  **Breaking Changes:**

  None. This is a backward-compatible addition. Existing code continues to work without changes.

  **Migration Guide:**

  No migration required. To use worker execution, simply add the `engine` option:

  ```typescript
  // Before (still works)
  parseString(csv);

  // After (with worker)
  parseString(csv, { engine: { worker: true } });

  // With WASM
  parseString(csv, { engine: { wasm: true } });

  // With both
  parseString(csv, { engine: { worker: true, wasm: true } });
  ```

  **Security Considerations:**

  - **Resource Protection**: When deploying applications that accept user-uploaded CSV files, it is strongly recommended to use `WorkerPool` with a limited `maxWorkers` setting to prevent resource exhaustion attacks
  - Malicious users could attempt to overwhelm the application by uploading multiple large CSV files simultaneously
  - Setting a reasonable `maxWorkers` limit (e.g., 2-4) helps protect against such attacks while maintaining good performance
  - Example secure configuration:

    ```typescript
    // Recommended: Limit concurrent workers to protect against attacks
    using pool = new WorkerPool({ maxWorkers: 4 });

    for await (const record of parseString(userUploadedCSV, {
      engine: { worker: true, workerPool: pool }
    })) {
      // Process records safely
    }
    ```

### Patch Changes

- [#547](https://github.com/kamiazya/web-csv-toolbox/pull/547) [`cec6905`](https://github.com/kamiazya/web-csv-toolbox/commit/cec6905200814e21efa17adbb4a6652519dd1e74) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix AbortSignal propagation in Transform Stream components

  This release fixes a security vulnerability where AbortSignal was not properly propagated through the Transform Stream pipeline, allowing processing to continue even after abort requests.

  **Fixed Issues:**

  - Fixed `LexerTransformer` to accept and propagate `AbortSignal` to internal `Lexer` instance
  - Fixed `RecordAssemblerTransformer` to properly propagate `AbortSignal` to internal `RecordAssembler` instance
  - Added comprehensive tests for AbortSignal propagation in Transform Stream components
  - Added `waitAbort` helper function to handle race conditions in AbortSignal tests
  - Improved constructor initialization order in both Transformer classes for better code clarity

  **Code Quality Improvements:**

  - Added `LexerTransformerOptions` type definition for better type consistency across Transformer classes
  - Refactored constructors to initialize local variables before `super()` calls, improving code readability
  - Removed redundant type intersections in `RecordAssemblerTransformer`
  - Eliminated code duplication by moving test helpers to shared location

  **Security Impact:**

  This fix addresses a medium-severity security issue where attackers could bypass abort signals in streaming CSV processing. Without this fix, malicious actors could send large CSV payloads and continue consuming system resources (CPU, memory) even after cancellation attempts, potentially causing service degradation or temporary resource exhaustion.

  **Before this fix:**

  ```ts
  const controller = new AbortController();
  const stream = largeCSVStream
    .pipeThrough(new LexerTransformer({ signal: controller.signal }))
    .pipeThrough(new RecordAssemblerTransformer({ signal: controller.signal }));

  controller.abort(); // Signal was ignored - processing continued!
  ```

  **After this fix:**

  ```ts
  const controller = new AbortController();
  const stream = largeCSVStream
    .pipeThrough(new LexerTransformer({ signal: controller.signal }))
    .pipeThrough(new RecordAssemblerTransformer({ signal: controller.signal }));

  controller.abort(); // Processing stops immediately with AbortError
  ```

  Users processing untrusted CSV streams should ensure they implement proper timeout and abort signal handling to prevent resource exhaustion.

- [#548](https://github.com/kamiazya/web-csv-toolbox/pull/548) [`3946273`](https://github.com/kamiazya/web-csv-toolbox/commit/3946273aa1c59a7b4a9fae6c2dbfae0d80999761) Thanks [@kamiazya](https://github.com/kamiazya)! - Add binary size limit protection to prevent memory exhaustion attacks

  - Add `maxBinarySize` option (default: 100MB) for ArrayBuffer/Uint8Array inputs
  - Throw `RangeError` when binary size exceeds the limit
  - Update documentation with security considerations for large file handling
  - Add comprehensive tests for binary size validation

- [#550](https://github.com/kamiazya/web-csv-toolbox/pull/550) [`7565212`](https://github.com/kamiazya/web-csv-toolbox/commit/756521231cde231531fdb74f1a3eeee8400b17f8) Thanks [@VaishnaviOnPC](https://github.com/VaishnaviOnPC)! - docs: Add headerless csv example

- [#566](https://github.com/kamiazya/web-csv-toolbox/pull/566) [`9da8ea2`](https://github.com/kamiazya/web-csv-toolbox/commit/9da8ea20512f2a1e07c4d78092cecedb63cd5455) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix header index mismatch when filtering empty header fields

  Fixed a critical bug in `CSVRecordAssembler` where empty header fields caused incorrect mapping of row values to headers during record assembly.

  ## The Bug

  When CSV headers contained empty fields (e.g., from trailing or leading commas), the record assembler would incorrectly map row values to header fields. This affected both the `#processToken()` method (for records with `RecordDelimiter`) and the `#flush()` method (for incomplete records at the end of streaming).

  **Example:**

  ```typescript
  // CSV with empty first header field:
  // ,name,age
  // skip,Alice,30

  // Before (incorrect):
  { name: 'skip', age: 'Alice' }

  // After (correct):
  { name: 'Alice', age: '30' }
  ```

  ## Root Cause

  The implementation filtered out empty headers first, then used the filtered array's indices to access `this.#row` values:

  ```typescript
  // Buggy code
  this.#header
    .filter((v) => v) // Filter creates new array with new indices
    .map((header, index) => [
      // 'index' is wrong - it's the filtered index
      header,
      this.#row.at(index), // Accesses wrong position in original row
    ]);
  ```

  ## The Fix

  Changed to preserve original indices before filtering:

  ```typescript
  // Fixed code
  this.#header
    .map((header, index) => [header, index] as const) // Capture original index
    .filter(([header]) => header) // Filter with index preserved
    .map(([header, index]) => [header, this.#row.at(index)]); // Use original index
  ```

  This fix is applied to both:

  - `#processToken()` - for records ending with `RecordDelimiter`
  - `#flush()` - for incomplete records at end of stream

  ## Impact

  This bug affected any CSV with empty header fields, which can occur from:

  - Trailing commas in headers: `name,age,`
  - Leading commas in headers: `,name,age`
  - Multiple consecutive commas: `name,,age`

  All such cases now correctly map row values to their corresponding headers.

- [#542](https://github.com/kamiazya/web-csv-toolbox/pull/542) [`b317547`](https://github.com/kamiazya/web-csv-toolbox/commit/b317547d6764b326a27bccaf7719abab968317bd) Thanks [@kamiazya](https://github.com/kamiazya)! - Add GMO Security Program badge to README.md

- [#560](https://github.com/kamiazya/web-csv-toolbox/pull/560) [`a520d54`](https://github.com/kamiazya/web-csv-toolbox/commit/a520d54311834d80163dfd1b4be0162ac4d22908) Thanks [@VaishnaviOnPC](https://github.com/VaishnaviOnPC)! - Add skipEmptyLines option to ParseOptions and parsing functions.

- [#561](https://github.com/kamiazya/web-csv-toolbox/pull/561) [`c3f786a`](https://github.com/kamiazya/web-csv-toolbox/commit/c3f786a4e480ec1609f1e5d305b955e18f6a1ac4) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve ReadableStream to AsyncIterableIterator conversion with native async iteration support

  **Performance Improvements:**

  - `convertStreamToAsyncIterableIterator` now preferentially uses native `Symbol.asyncIterator` when available
  - Provides better performance in modern browsers and runtimes
  - Falls back to manual reader-based iteration for Safari and older environments
  - Improved condition check to verify async iterator is actually callable

  **Resource Management Improvements:**

  - Added proper error handling with `reader.cancel(error)` to release underlying resources on error
  - Cancel errors are gracefully ignored when already in error state
  - `reader.releaseLock()` is always called in `finally` block for reliable cleanup
  - Prevents potential memory leaks from unreleased stream locks

## 0.12.0

### Minor Changes

- [#533](https://github.com/kamiazya/web-csv-toolbox/pull/533) [`b221fc7`](https://github.com/kamiazya/web-csv-toolbox/commit/b221fc714faa4b33d33a3349982a1608d8a19b2f) Thanks [@kamiazya](https://github.com/kamiazya)! - Migrate to ESM-only distribution

  This release removes CommonJS (CJS) and UMD build outputs, distributing only ES modules (ESM). All build artifacts are now placed directly in the `dist/` directory for a simpler and cleaner structure.

  ### Breaking Changes

  - **Removed CommonJS support**: The package no longer provides `.cjs` files. Node.js projects must use ES modules.
  - **Removed UMD bundle**: The UMD build (`dist/web-csv-toolbox.umd.js`) has been removed. For CDN usage, use ESM via `<script type="module">`.
  - **Changed distribution structure**: Build outputs moved from `dist/es/`, `dist/cjs/`, and `dist/types/` to `dist/` root directory.
  - **Removed `build:browser` command**: The separate UMD build step is no longer needed.

  ### Migration Guide

  **For Node.js users:**

  - Ensure your project uses `"type": "module"` in `package.json`, or use `.mjs` file extensions
  - Update any CommonJS `require()` calls to ESM `import` statements
  - Node.js 20.x or later is required (already the minimum supported version)

  **For CDN users:**
  Before:

  ```html
  <script src="https://unpkg.com/web-csv-toolbox"></script>
  ```

  After:

  ```html
  <script type="module">
    import { parse } from "https://unpkg.com/web-csv-toolbox";
  </script>
  ```

  **For bundler users:**
  No changes required - modern bundlers handle ESM correctly.

  ### Benefits

  - Simpler build configuration and faster build times
  - Smaller package size
  - Cleaner distribution structure
  - Alignment with modern JavaScript ecosystem standards

- [#476](https://github.com/kamiazya/web-csv-toolbox/pull/476) [`ae54611`](https://github.com/kamiazya/web-csv-toolbox/commit/ae54611c2b5801dc7027e1c7d2d89cca51e6dd5f) Thanks [@kamiazya](https://github.com/kamiazya)! - Drop support Node.js v18 and Add test on Node.js v24

### Patch Changes

- [#535](https://github.com/kamiazya/web-csv-toolbox/pull/535) [`009c762`](https://github.com/kamiazya/web-csv-toolbox/commit/009c762a8c080242913ba7bf698f66c645d5eff8) Thanks [@egoitz-ehu](https://github.com/egoitz-ehu)! - Close issue #524

- [#532](https://github.com/kamiazya/web-csv-toolbox/pull/532) [`fc4fc57`](https://github.com/kamiazya/web-csv-toolbox/commit/fc4fc577fe49e68164909f314c7d5ec6b4e82a46) Thanks [@sshekhar563](https://github.com/sshekhar563)! - fix(docs): correct typo 'Lexter' → 'Lexer' in Lexer.ts JSDoc

- [#529](https://github.com/kamiazya/web-csv-toolbox/pull/529) [`76df785`](https://github.com/kamiazya/web-csv-toolbox/commit/76df7852502cd365d12f63500bbbb1fb45f3485c) Thanks [@kamiazya](https://github.com/kamiazya)! - Migrate npm package publishing to OIDC trusted publishing for enhanced security

- [#531](https://github.com/kamiazya/web-csv-toolbox/pull/531) [`a273b9d`](https://github.com/kamiazya/web-csv-toolbox/commit/a273b9da8477ad58f50239be69229ab3bf519551) Thanks [@VaishnaviOnPC](https://github.com/VaishnaviOnPC)! - fix: correct typo in escapeField.ts comment ('ASSTPTED' → 'ASSERTED')

## 0.11.2

### Patch Changes

- [#474](https://github.com/kamiazya/web-csv-toolbox/pull/474) [`21a3e4e`](https://github.com/kamiazya/web-csv-toolbox/commit/21a3e4ed39573526303b3caa93747bf0ac1b83f7) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix and refactor documentation deploy workflow

## 0.11.1

### Patch Changes

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump serde_json from 1.0.125 to 1.0.140 in /web-csv-toolbox-wasm

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump csv from 1.3.0 to 1.3.1 in /web-csv-toolbox-wasm

- [#472](https://github.com/kamiazya/web-csv-toolbox/pull/472) [`96582d0`](https://github.com/kamiazya/web-csv-toolbox/commit/96582d0588a88a6c5dbb592a2ca1f3369118ea94) Thanks [@kamiazya](https://github.com/kamiazya)! - Upgrade dev dependencies

  - Add wasm-pack to 0.13
  - Updated biome to 1.9
  - Updated typedoc to 0.28
  - Updated TypeScript to 5.8
  - Updated Vite to 6.3
  - Updated vite-plugin-dts to 4.5
  - Updated vitest to 3.2
  - Updated webdriverio to 9.15

  ## Summary of Changes

  - Added `hexa` function for generating hexadecimal strings.
  - Introduced `unicode` and `unicodeMapper` functions for better Unicode string handling.
  - Updated `text` function to utilize new string generation methods for "hexa", "unicode", and "string16bits".
  - Cleaned up snapshot tests in `parseResponse.spec.ts` and `parseResponseToStream.spec.ts` by removing unnecessary comments.
  - Created a new declaration file for the `web-csv-toolbox-wasm` module to improve type safety.
  - Modified `tsconfig.json` to exclude all test files from compilation, improving build performance.

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump compiler_builtins from 0.1.119 to 0.1.158 in /web-csv-toolbox-wasm

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.2.4 to 4.0.15

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps-dev): bump @changesets/cli from 2.27.6 to 2.29.3

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - Use fast-check instead of @fast-check/vitest in test files

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump the cargo group in /web-csv-toolbox-wasm with 2 updates

## 0.11.0

### Minor Changes

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Dynamic Type Inference and User-Defined Types from CSV Headers

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Remove InvalidOptionError class

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Support AbortSignal

### Patch Changes

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump typedoc from 0.25.13 to 0.26.6

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump fast-check from 3.19.0 to 3.21.0

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump wasm-pack from 0.12.1 to 0.13.0 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Remove unnecessary processes for convertIterableIteratorToAsync function

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump serde_json from 1.0.117 to 1.0.125 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump serde from 1.0.203 to 1.0.208 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.2.1 to 3.2.4

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Update concurrency configuration in main Workflow

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump cxx-build from 1.0.124 to 1.0.126 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump compiler_builtins from 0.1.112 to 0.1.119 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump vite from 5.3.1 to 5.4.2

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Refactor CI/CD workflow

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump @biomejs/biome from 1.8.2 to 1.8.3

## 0.10.2

### Patch Changes

- [#269](https://github.com/kamiazya/web-csv-toolbox/pull/269) [`7b84c8c`](https://github.com/kamiazya/web-csv-toolbox/commit/7b84c8c8f6979cc45508bd1c3e1daeca8fe0a00a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump cxx-build from 1.0.123 to 1.0.124 in /web-csv-toolbox-wasm

- [#272](https://github.com/kamiazya/web-csv-toolbox/pull/272) [`574bee2`](https://github.com/kamiazya/web-csv-toolbox/commit/574bee290399ac05fcd73c60c757421d23b317de) Thanks [@kamiazya](https://github.com/kamiazya)! - Update Snapshot release configuration

- [#274](https://github.com/kamiazya/web-csv-toolbox/pull/274) [`a163f35`](https://github.com/kamiazya/web-csv-toolbox/commit/a163f35fa08c92a57e24891740b488c906cf4dac) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.29 to 3.2.1

- [#276](https://github.com/kamiazya/web-csv-toolbox/pull/276) [`5daa58b`](https://github.com/kamiazya/web-csv-toolbox/commit/5daa58b5ed03fb78bf51f31ee26f3d680fac7ee4) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @biomejs/biome from 1.7.3 to 1.8.2

- [#266](https://github.com/kamiazya/web-csv-toolbox/pull/266) [`2c1e872`](https://github.com/kamiazya/web-csv-toolbox/commit/2c1e87207af2448180a6dc07be5290ab3744f005) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump terser from 5.31.0 to 5.31.1

- [#275](https://github.com/kamiazya/web-csv-toolbox/pull/275) [`2aa667c`](https://github.com/kamiazya/web-csv-toolbox/commit/2aa667c478c23d1aa9427e4c2a1c6c1aeb447b12) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @changesets/cli from 2.27.1 to 2.27.6

- [#267](https://github.com/kamiazya/web-csv-toolbox/pull/267) [`b6db634`](https://github.com/kamiazya/web-csv-toolbox/commit/b6db634668df4e5f15ea388eef66b2420a11ea42) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite from 5.2.13 to 5.3.1

## 0.10.1

### Patch Changes

- [#253](https://github.com/kamiazya/web-csv-toolbox/pull/253) [`044b0e6`](https://github.com/kamiazya/web-csv-toolbox/commit/044b0e63da3c583aaf2e04c301eeb56e0ff2ed2d) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc from 0.25.12 to 0.25.13

- [#257](https://github.com/kamiazya/web-csv-toolbox/pull/257) [`926244a`](https://github.com/kamiazya/web-csv-toolbox/commit/926244a20b763d94f0956d5b1363c71fb3af7209) Thanks [@kamiazya](https://github.com/kamiazya)! - Remove lefthook configuration file

- [#259](https://github.com/kamiazya/web-csv-toolbox/pull/259) [`f4dd3d8`](https://github.com/kamiazya/web-csv-toolbox/commit/f4dd3d82c8f9921973463e2e0e001deccec262ca) Thanks [@kamiazya](https://github.com/kamiazya)! - Add .node-version file and update Node.js setup in GitHub workflows

- [#256](https://github.com/kamiazya/web-csv-toolbox/pull/256) [`a6b22e9`](https://github.com/kamiazya/web-csv-toolbox/commit/a6b22e993a1eeb93ddd177963afc8132852ea15b) Thanks [@kamiazya](https://github.com/kamiazya)! - Export errors classes

- [#250](https://github.com/kamiazya/web-csv-toolbox/pull/250) [`cbdb5cb`](https://github.com/kamiazya/web-csv-toolbox/commit/cbdb5cb45b90d6e174d96808ac576338993a9794) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite-plugin-dts from 3.7.3 to 3.9.1

- [#255](https://github.com/kamiazya/web-csv-toolbox/pull/255) [`49af679`](https://github.com/kamiazya/web-csv-toolbox/commit/49af67945b5589d83ac00d2be4b83feb5e4a3859) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor ParseError class to extend SyntaxError

- [#251](https://github.com/kamiazya/web-csv-toolbox/pull/251) [`65db459`](https://github.com/kamiazya/web-csv-toolbox/commit/65db45913456c3df355c75afd1120f791bec79fa) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @fast-check/vitest from 0.1.0 to 0.1.1

- [#260](https://github.com/kamiazya/web-csv-toolbox/pull/260) [`6047e50`](https://github.com/kamiazya/web-csv-toolbox/commit/6047e50c151c93994aca59fac9d29ecb33d8a015) Thanks [@kamiazya](https://github.com/kamiazya)! - Add test on Node.js 22

- [#258](https://github.com/kamiazya/web-csv-toolbox/pull/258) [`824ef20`](https://github.com/kamiazya/web-csv-toolbox/commit/824ef201be688a22e699259f86d8cb9a5ebf734f) Thanks [@kamiazya](https://github.com/kamiazya)! - Update package manager to pnpm@9.3.0

- [#252](https://github.com/kamiazya/web-csv-toolbox/pull/252) [`1ebbdb4`](https://github.com/kamiazya/web-csv-toolbox/commit/1ebbdb43e954a236b889a0ca166386c836cc7e36) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.18 to 3.1.29

- [#239](https://github.com/kamiazya/web-csv-toolbox/pull/239) [`88fbef6`](https://github.com/kamiazya/web-csv-toolbox/commit/88fbef62cd710ad7fb85123276cb560634692d31) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.34.1 to 8.38.2

## 0.10.0

### Minor Changes

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor error handling and add new error classes

### Patch Changes

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump cxx-build from 1.0.119 to 1.0.123 in /web-csv-toolbox-wasm

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump moonrepo/setup-rust from 1.1.0 to 1.2.0

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps-dev): bump vite from 5.1.7 to 5.2.13

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump compiler_builtins from 0.1.108 to 0.1.112 in /web-csv-toolbox-wasm

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump serde_json from 1.0.114 to 1.0.117 in /web-csv-toolbox-wasm

- [#185](https://github.com/kamiazya/web-csv-toolbox/pull/185) [`2b4aa28`](https://github.com/kamiazya/web-csv-toolbox/commit/2b4aa28e9d6147a7ffc0a5240742bf8c19d8cd2d) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump wasm-opt from 0.116.0 to 0.116.1 in /web-csv-toolbox-wasm

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps-dev): bump fast-check from 3.15.1 to 3.19.0

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump serde from 1.0.197 to 1.0.203 in /web-csv-toolbox-wasm

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - Disable macos FireFox browser testing on CI

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - Add type check script and update CI workflow

## 0.9.0

### Minor Changes

- [`d8ad2f7`](https://github.com/kamiazya/web-csv-toolbox/commit/d8ad2f75267e78a1e30a0cb6f2c596925cf60c96) Thanks [@kamiazya](https://github.com/kamiazya)! - Add detailed position tracking for tokens

### Patch Changes

- [#208](https://github.com/kamiazya/web-csv-toolbox/pull/208) [`35997de`](https://github.com/kamiazya/web-csv-toolbox/commit/35997de35b4b06e1993bedc5986400a669e0adc9) Thanks [@kamiazya](https://github.com/kamiazya)! - Create tea.yaml

- [#233](https://github.com/kamiazya/web-csv-toolbox/pull/233) [`4d3e09f`](https://github.com/kamiazya/web-csv-toolbox/commit/4d3e09f95735559101993f23a01c27bc6f93409e) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor test CSV generation code around BOM

- [#175](https://github.com/kamiazya/web-csv-toolbox/pull/175) [`f3234a7`](https://github.com/kamiazya/web-csv-toolbox/commit/f3234a74c91369ad03b51d41967bb9ea968f5550) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor Lexer for performance improvement

- [#182](https://github.com/kamiazya/web-csv-toolbox/pull/182) [`cb649b3`](https://github.com/kamiazya/web-csv-toolbox/commit/cb649b357585e2947345f836ab19410fb95715f8) Thanks [@kamiazya](https://github.com/kamiazya)! - Update benchmark iterations

- [#240](https://github.com/kamiazya/web-csv-toolbox/pull/240) [`cdfa359`](https://github.com/kamiazya/web-csv-toolbox/commit/cdfa359c8c68bba94a65d312c78e311bcdb02a64) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve CSV token handling

- [#175](https://github.com/kamiazya/web-csv-toolbox/pull/175) [`f3234a7`](https://github.com/kamiazya/web-csv-toolbox/commit/f3234a74c91369ad03b51d41967bb9ea968f5550) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve Lexer internal operation

- [#236](https://github.com/kamiazya/web-csv-toolbox/pull/236) [`129235a`](https://github.com/kamiazya/web-csv-toolbox/commit/129235a851281b4f225cfece23c63645ad22b031) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump terser from 5.29.2 to 5.31.0

- [#217](https://github.com/kamiazya/web-csv-toolbox/pull/217) [`ac010a7`](https://github.com/kamiazya/web-csv-toolbox/commit/ac010a7748aa90aa6cb7fc67d844528af748fde4) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @biomejs/biome from 1.6.1 to 1.7.3

## 0.8.0

### Minor Changes

- [#168](https://github.com/kamiazya/web-csv-toolbox/pull/168) [`7fad0d1`](https://github.com/kamiazya/web-csv-toolbox/commit/7fad0d16446181bcc65d59c6f3298e7a106f3203) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor CSV parsing options and assertions

### Patch Changes

- [`4a0077c`](https://github.com/kamiazya/web-csv-toolbox/commit/4a0077c2e8d708a21b31042df80f979b82ff503c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add vitest benchmark test and codspeed intagration

## 0.7.5

### Patch Changes

- [#151](https://github.com/kamiazya/web-csv-toolbox/pull/151) [`0435339`](https://github.com/kamiazya/web-csv-toolbox/commit/0435339706a973909c58e58a36472c6ac9ff62d9) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump serde from 1.0.196 to 1.0.197 in /web-csv-toolbox-wasm

- [#152](https://github.com/kamiazya/web-csv-toolbox/pull/152) [`2a39563`](https://github.com/kamiazya/web-csv-toolbox/commit/2a39563cc7e015a220a56b311edba5b731f7c61c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump cxx-build from 1.0.116 to 1.0.119 in /web-csv-toolbox-wasm

- [#153](https://github.com/kamiazya/web-csv-toolbox/pull/153) [`0025866`](https://github.com/kamiazya/web-csv-toolbox/commit/0025866f1c5df2bbc110d92b6fadaa6b55caac30) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump codecov/codecov-action from 4.0.2 to 4.1.0

- [#154](https://github.com/kamiazya/web-csv-toolbox/pull/154) [`65c6413`](https://github.com/kamiazya/web-csv-toolbox/commit/65c6413a63db50fa825a3630d362e1cb26fb81eb) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump terser from 5.27.0 to 5.29.2

- [#155](https://github.com/kamiazya/web-csv-toolbox/pull/155) [`d7dcec4`](https://github.com/kamiazya/web-csv-toolbox/commit/d7dcec41bc17b0dd7ad84c08358c9d5f4784edd3) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump web-sys from 0.3.68 to 0.3.69 in /web-csv-toolbox-wasm

- [#157](https://github.com/kamiazya/web-csv-toolbox/pull/157) [`aea3d17`](https://github.com/kamiazya/web-csv-toolbox/commit/aea3d173bbd6c0b4e2c3a1917354d9d98345bd24) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump wasm-bindgen from 0.2.91 to 0.2.92 in /web-csv-toolbox-wasm

- [#161](https://github.com/kamiazya/web-csv-toolbox/pull/161) [`e61b090`](https://github.com/kamiazya/web-csv-toolbox/commit/e61b0909d4f6b66acc5a1f0e69482687ca21198f) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @biomejs/biome from 1.5.3 to 1.6.1

- [#162](https://github.com/kamiazya/web-csv-toolbox/pull/162) [`05bde86`](https://github.com/kamiazya/web-csv-toolbox/commit/05bde864ff2d3bb2ffc603c4ecade3cfbf2e5787) Thanks [@kamiazya](https://github.com/kamiazya)! - Update import statements to use type imports

## 0.7.4

### Patch Changes

- [#118](https://github.com/kamiazya/web-csv-toolbox/pull/118) [`3df7386`](https://github.com/kamiazya/web-csv-toolbox/commit/3df73863ed20794985a038f982a6b8ea9f8194cf) Thanks [@kamiazya](https://github.com/kamiazya)! - Create update-license-year.yaml

- [#108](https://github.com/kamiazya/web-csv-toolbox/pull/108) [`bcd6490`](https://github.com/kamiazya/web-csv-toolbox/commit/bcd64903a19c363a289193a65470a8c38b52e94e) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/configure-pages from 3.0.7 to 4.0.0

- [#109](https://github.com/kamiazya/web-csv-toolbox/pull/109) [`401cb18`](https://github.com/kamiazya/web-csv-toolbox/commit/401cb1873ee09dc9deef14488c36272e21421094) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump codecov/codecov-action from 3.1.6 to 4.0.1

- [#110](https://github.com/kamiazya/web-csv-toolbox/pull/110) [`9a030a2`](https://github.com/kamiazya/web-csv-toolbox/commit/9a030a2a60854c2bc5125e99e3835fc3fc75158d) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/github-script from 6.4.1 to 7.0.1

- [#111](https://github.com/kamiazya/web-csv-toolbox/pull/111) [`6a92edd`](https://github.com/kamiazya/web-csv-toolbox/commit/6a92eddc54f673d7765966c6648a88ec3d0184fe) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump denoland/setup-deno from 1.1.3 to 1.1.4

- [#112](https://github.com/kamiazya/web-csv-toolbox/pull/112) [`60d90da`](https://github.com/kamiazya/web-csv-toolbox/commit/60d90da0b0fd271198e4e95e3967c154b15950a9) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/setup-python from 4.7.1 to 5.0.0

- [#113](https://github.com/kamiazya/web-csv-toolbox/pull/113) [`859b0ed`](https://github.com/kamiazya/web-csv-toolbox/commit/859b0edbbee8054dc934f9e9f4d73fc936875854) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.14 to 3.1.15

- [#114](https://github.com/kamiazya/web-csv-toolbox/pull/114) [`46faf64`](https://github.com/kamiazya/web-csv-toolbox/commit/46faf644b63efaae56f63f844189681a82c5eb63) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump husky from 9.0.7 to 9.0.10

- [#124](https://github.com/kamiazya/web-csv-toolbox/pull/124) [`24e3e4b`](https://github.com/kamiazya/web-csv-toolbox/commit/24e3e4b9166e8f141aa65f051ffcf4f5391d051a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/setup-node from 4.0.1 to 4.0.2

- [#125](https://github.com/kamiazya/web-csv-toolbox/pull/125) [`63fd59c`](https://github.com/kamiazya/web-csv-toolbox/commit/63fd59ca2a76f70a7d92d3718659b4b5131bf663) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/upload-pages-artifact from 3.0.0 to 3.0.1

- [#127](https://github.com/kamiazya/web-csv-toolbox/pull/127) [`268018d`](https://github.com/kamiazya/web-csv-toolbox/commit/268018d07ebed3bafc4be794a43020d6d39b471c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.29.7 to 8.31.0

- [#128](https://github.com/kamiazya/web-csv-toolbox/pull/128) [`95a7d09`](https://github.com/kamiazya/web-csv-toolbox/commit/95a7d0969cc434eb5c8831dced5a155e6cf91bef) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/deploy-pages from 4.0.3 to 4.0.4

- [#129](https://github.com/kamiazya/web-csv-toolbox/pull/129) [`da273c8`](https://github.com/kamiazya/web-csv-toolbox/commit/da273c89927e1627233d6de426e7aad09a58efb0) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump web-sys from 0.3.67 to 0.3.68 in /web-csv-toolbox-wasm

- [#130](https://github.com/kamiazya/web-csv-toolbox/pull/130) [`e66e8ad`](https://github.com/kamiazya/web-csv-toolbox/commit/e66e8ad0572e56c3ac8e67211e9481075aa5cb7a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/upload-artifact from 4.3.0 to 4.3.1

- [#131](https://github.com/kamiazya/web-csv-toolbox/pull/131) [`8bc8c19`](https://github.com/kamiazya/web-csv-toolbox/commit/8bc8c19e0c694819e3b2e5d40ff1e3f742ea3a5f) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump wasm-bindgen from 0.2.90 to 0.2.91 in /web-csv-toolbox-wasm

- [#132](https://github.com/kamiazya/web-csv-toolbox/pull/132) [`73c1409`](https://github.com/kamiazya/web-csv-toolbox/commit/73c1409debefd3a71008978f2074f2e7263b1e15) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump lint-staged from 15.2.1 to 15.2.2

- [#133](https://github.com/kamiazya/web-csv-toolbox/pull/133) [`c1d593b`](https://github.com/kamiazya/web-csv-toolbox/commit/c1d593b93ecdab954958456e7eb3b6710cbb223e) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump compiler_builtins from 0.1.107 to 0.1.108 in /web-csv-toolbox-wasm

- [#136](https://github.com/kamiazya/web-csv-toolbox/pull/136) [`2f60c6f`](https://github.com/kamiazya/web-csv-toolbox/commit/2f60c6f5ab8b1caa39bb89a5442d64600e9f1670) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/download-artifact from 4.1.1 to 4.1.2

- [#137](https://github.com/kamiazya/web-csv-toolbox/pull/137) [`a9d864f`](https://github.com/kamiazya/web-csv-toolbox/commit/a9d864fee5c034d9731a61b49c75dcc0c4d36edd) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump pnpm/action-setup from 2.4.0 to 3.0.0

- [#139](https://github.com/kamiazya/web-csv-toolbox/pull/139) [`88590c2`](https://github.com/kamiazya/web-csv-toolbox/commit/88590c270be142a0923b0f1f3682271924ea6365) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite from 5.0.12 to 5.1.1

- [#140](https://github.com/kamiazya/web-csv-toolbox/pull/140) [`dead424`](https://github.com/kamiazya/web-csv-toolbox/commit/dead4246dbe1ba8ad2c9d2b3413f5d4f7f283fab) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.31.0 to 8.31.1

- [#141](https://github.com/kamiazya/web-csv-toolbox/pull/141) [`4710eec`](https://github.com/kamiazya/web-csv-toolbox/commit/4710eec87cb715989801a4ee3cec37f4fb9444e7) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.15 to 3.1.16

- [#142](https://github.com/kamiazya/web-csv-toolbox/pull/142) [`3a8fc90`](https://github.com/kamiazya/web-csv-toolbox/commit/3a8fc9098648c3d9d5c5327f23f988ed8441f615) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump cxx-build from 1.0.115 to 1.0.116 in /web-csv-toolbox-wasm

- [#143](https://github.com/kamiazya/web-csv-toolbox/pull/143) [`952b6b6`](https://github.com/kamiazya/web-csv-toolbox/commit/952b6b60f3fdd7dc3d7200fcbd164fea212325c6) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump husky from 9.0.10 to 9.0.11

- [#144](https://github.com/kamiazya/web-csv-toolbox/pull/144) [`58bf707`](https://github.com/kamiazya/web-csv-toolbox/commit/58bf70782a7b6bc6a3bb70a16d2677f62587895c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump changesets/action from 1.4.5 to 1.4.6

- [#145](https://github.com/kamiazya/web-csv-toolbox/pull/145) [`5d839be`](https://github.com/kamiazya/web-csv-toolbox/commit/5d839be594804613929e236086d9fa862ccce4bf) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump thollander/actions-comment-pull-request from 2.4.3 to 2.5.0

- [#146](https://github.com/kamiazya/web-csv-toolbox/pull/146) [`15f972e`](https://github.com/kamiazya/web-csv-toolbox/commit/15f972e69227e496d59cdf9d373c7b76132d4562) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump the npm_and_yarn group across 1 directories with 1 update

- [#147](https://github.com/kamiazya/web-csv-toolbox/pull/147) [`0a9d60c`](https://github.com/kamiazya/web-csv-toolbox/commit/0a9d60cae8d547f0d2f13186f0f02c1c12aa37dc) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump serde_json from 1.0.113 to 1.0.114 in /web-csv-toolbox-wasm

- [#148](https://github.com/kamiazya/web-csv-toolbox/pull/148) [`a4031f5`](https://github.com/kamiazya/web-csv-toolbox/commit/a4031f521043d180f9154e21763ce75620bb6d22) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump codecov/codecov-action from 4.0.1 to 4.0.2

- [#149](https://github.com/kamiazya/web-csv-toolbox/pull/149) [`c7fbb8a`](https://github.com/kamiazya/web-csv-toolbox/commit/c7fbb8ad37262c8a4d3842f6a6e58749b34a7cbd) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/download-artifact from 4.1.2 to 4.1.4

- [#150](https://github.com/kamiazya/web-csv-toolbox/pull/150) [`d2bebfc`](https://github.com/kamiazya/web-csv-toolbox/commit/d2bebfcf374c4144423e4964e06ea74e0325aaaf) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc from 0.25.7 to 0.25.12

- [#134](https://github.com/kamiazya/web-csv-toolbox/pull/134) [`cf1f9ae`](https://github.com/kamiazya/web-csv-toolbox/commit/cf1f9ae6ef379686a68d8afd112dd541129b0a3f) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix artefacts summary generation condition

- [#95](https://github.com/kamiazya/web-csv-toolbox/pull/95) [`8e6b7ac`](https://github.com/kamiazya/web-csv-toolbox/commit/8e6b7ac563e340e72496991d33cde714f4d36b51) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @fast-check/vitest from 0.0.9 to 0.1.0

- [#119](https://github.com/kamiazya/web-csv-toolbox/pull/119) [`4699780`](https://github.com/kamiazya/web-csv-toolbox/commit/4699780384169243e56ef4614035fde57d4ca792) Thanks [@github-actions](https://github.com/apps/github-actions)! - Update license copyright year(s)

- [#115](https://github.com/kamiazya/web-csv-toolbox/pull/115) [`30ab2e8`](https://github.com/kamiazya/web-csv-toolbox/commit/30ab2e82258454fdfde9270b1e797183a7deb4b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix Lexer class

- [#107](https://github.com/kamiazya/web-csv-toolbox/pull/107) [`a47248f`](https://github.com/kamiazya/web-csv-toolbox/commit/a47248fb4f23f709753decaba26d9f739c1b7238) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve GitHub Actions Workflows

- [#135](https://github.com/kamiazya/web-csv-toolbox/pull/135) [`21b2d9c`](https://github.com/kamiazya/web-csv-toolbox/commit/21b2d9ccfbb896297a9c47483a2e093aafe3591d) Thanks [@kamiazya](https://github.com/kamiazya)! - Pined license year action versions

- [#94](https://github.com/kamiazya/web-csv-toolbox/pull/94) [`379d899`](https://github.com/kamiazya/web-csv-toolbox/commit/379d899fb3756f5e779771f6c4df68f0bb9289c0) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump lint-staged from 15.2.0 to 15.2.1

## 0.7.3

### Patch Changes

- [#101](https://github.com/kamiazya/web-csv-toolbox/pull/101) [`534dff9`](https://github.com/kamiazya/web-csv-toolbox/commit/534dff9c3e2e02140d79097053603df4283ffa3f) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.29.1 to 8.29.7

- [#104](https://github.com/kamiazya/web-csv-toolbox/pull/104) [`10c7be9`](https://github.com/kamiazya/web-csv-toolbox/commit/10c7be97fb84a5d74acae4eaebe379c353c9fc2a) Thanks [@kamiazya](https://github.com/kamiazya)! - Add tests

- [#96](https://github.com/kamiazya/web-csv-toolbox/pull/96) [`93e0f9c`](https://github.com/kamiazya/web-csv-toolbox/commit/93e0f9c6f2d36e4aa856e624ccec513b3f84d462) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump fast-check from 3.15.0 to 3.15.1

- [#102](https://github.com/kamiazya/web-csv-toolbox/pull/102) [`15a15f9`](https://github.com/kamiazya/web-csv-toolbox/commit/15a15f9fc1c973ad6aab9daf6e38e402475b68b7) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix CI triggers

- [#100](https://github.com/kamiazya/web-csv-toolbox/pull/100) [`3eda346`](https://github.com/kamiazya/web-csv-toolbox/commit/3eda346ca68b6a0da36825d3f813e936c34d6aab) Thanks [@kamiazya](https://github.com/kamiazya)! - Update CI/CD workflows and Correct Coverage

- [#92](https://github.com/kamiazya/web-csv-toolbox/pull/92) [`9988bd7`](https://github.com/kamiazya/web-csv-toolbox/commit/9988bd7edaa3ca16c9b16bcdd46ddcee39e61934) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump compiler_builtins from 0.1.106 to 0.1.107 in /web-csv-toolbox-wasm

## 0.7.2

### Patch Changes

- [#83](https://github.com/kamiazya/web-csv-toolbox/pull/83) [`08de2d0`](https://github.com/kamiazya/web-csv-toolbox/commit/08de2d0e47b58f323129c8a18e2237357bbeaf85) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @biomejs/biome from 1.5.2 to 1.5.3

- [#98](https://github.com/kamiazya/web-csv-toolbox/pull/98) [`e156adb`](https://github.com/kamiazya/web-csv-toolbox/commit/e156adb80493aab43f236c4275bda51ebbc82193) Thanks [@kamiazya](https://github.com/kamiazya)! - Add provenance to publishConfig in package.json

## 0.7.1

### Patch Changes

- [#86](https://github.com/kamiazya/web-csv-toolbox/pull/86) [`44a6697`](https://github.com/kamiazya/web-csv-toolbox/commit/44a6697d2daa721d7269971c3c2824ac94b996d5) Thanks [@kamiazya](https://github.com/kamiazya)! - Add web_csv_toolbox_wasm_bg.wasm to package.json

- [#90](https://github.com/kamiazya/web-csv-toolbox/pull/90) [`5dcae2e`](https://github.com/kamiazya/web-csv-toolbox/commit/5dcae2e49b45b6575a088692db2c3ed252e21317) Thanks [@kamiazya](https://github.com/kamiazya)! - Migrate Husky to v9

- [#87](https://github.com/kamiazya/web-csv-toolbox/pull/87) [`e308015`](https://github.com/kamiazya/web-csv-toolbox/commit/e30801534edc487a9df544049be2ae6adad37156) Thanks [@kamiazya](https://github.com/kamiazya)! - Add PullRequest snapshot release action

- [#84](https://github.com/kamiazya/web-csv-toolbox/pull/84) [`de81672`](https://github.com/kamiazya/web-csv-toolbox/commit/de816725338ae2fec542cd505a4922538c86bd68) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump serde_json from 1.0.112 to 1.0.113 in /web-csv-toolbox-wasm

- [#91](https://github.com/kamiazya/web-csv-toolbox/pull/91) [`14f7dab`](https://github.com/kamiazya/web-csv-toolbox/commit/14f7daba3f72734d4bb975dac3115a6a556a11fd) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix documentation build

## 0.7.0

### Minor Changes

- [#70](https://github.com/kamiazya/web-csv-toolbox/pull/70) [`75642e9`](https://github.com/kamiazya/web-csv-toolbox/commit/75642e90ace412d1564537d2ca9655b66160949c) Thanks [@kamiazya](https://github.com/kamiazya)! - Support parsing CSV by WASM build by Rust

  - **New Features**

    - Introduced WebAssembly support for high-performance CSV parsing in the CSV Toolbox, including new APIs and limitations.
    - Added a weekly update schedule for cargo package dependencies.
    - Implemented a Vite plugin for integrating WebAssembly modules into projects.

  - **Enhancements**

    - Added new configuration rule for Rust files, setting indent size to 4 spaces.
    - Enhanced continuous integration and deployment workflows with additional steps for Rust and WebAssembly setup.
    - Updated documentation to reflect WebAssembly features and usage in CSV parsing.

  - **Chores**
    - Introduced linting and formatting checks for JavaScript, TypeScript, JSON, and Rust files.

### Patch Changes

- [#76](https://github.com/kamiazya/web-csv-toolbox/pull/76) [`c9194d2`](https://github.com/kamiazya/web-csv-toolbox/commit/c9194d22f6ce7883af3bed2bf8bac3abfc2dee33) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.2.0 to 1.2.1

- [#75](https://github.com/kamiazya/web-csv-toolbox/pull/75) [`9680f6b`](https://github.com/kamiazya/web-csv-toolbox/commit/9680f6b83f6557764567afb78ff5880a0d624195) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite-plugin-dts from 3.7.0 to 3.7.1

- [#80](https://github.com/kamiazya/web-csv-toolbox/pull/80) [`b5438c0`](https://github.com/kamiazya/web-csv-toolbox/commit/b5438c0c8dd45fd6161c643e701e88ad9ce77c82) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.2.1 to 1.2.2

- [#82](https://github.com/kamiazya/web-csv-toolbox/pull/82) [`ce5f78c`](https://github.com/kamiazya/web-csv-toolbox/commit/ce5f78c9adf19b6e8d214de1c4293ada7996f64c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.27.2 to 8.29.1

- [#81](https://github.com/kamiazya/web-csv-toolbox/pull/81) [`94010de`](https://github.com/kamiazya/web-csv-toolbox/commit/94010de3cac7041b34b647ec2013a06bea785441) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite from 5.0.11 to 5.0.12

- [#77](https://github.com/kamiazya/web-csv-toolbox/pull/77) [`62d61aa`](https://github.com/kamiazya/web-csv-toolbox/commit/62d61aa1d121f71bd019f3862660ce966f8beb7a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.12 to 3.1.13

- [#79](https://github.com/kamiazya/web-csv-toolbox/pull/79) [`802a86f`](https://github.com/kamiazya/web-csv-toolbox/commit/802a86f2c6532ffef5984ae89cc6d27b53c6f242) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @vitest/browser from 1.2.0 to 1.2.2

- [#73](https://github.com/kamiazya/web-csv-toolbox/pull/73) [`a9ed6d0`](https://github.com/kamiazya/web-csv-toolbox/commit/a9ed6d0d2aed31e0ab5fada2b50a336258a636f1) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump terser from 5.26.0 to 5.27.0

## 0.6.1

### Patch Changes

- [#66](https://github.com/kamiazya/web-csv-toolbox/pull/66) [`73acb1b`](https://github.com/kamiazya/web-csv-toolbox/commit/73acb1b8221500bb564852471026b969d84dcdac) Thanks [@kamiazya](https://github.com/kamiazya)! - Migrates the project to use pnpm as the package manager and updates the build and dependency setup accordingly.

  - **Chores**
    - Switched package management from npm to pnpm to improve installation efficiency and reliability.
    - Updated continuous integration and deployment workflows to support pnpm.

## 0.6.0

### Minor Changes

- [#62](https://github.com/kamiazya/web-csv-toolbox/pull/62) [`9bd0ccc`](https://github.com/kamiazya/web-csv-toolbox/commit/9bd0ccc2f100f58156672ca282c1d6562b414425) Thanks [@kamiazya](https://github.com/kamiazya)! - - **New Features**

  - Introduced a new build configuration for generating a UMD format of the web CSV toolbox library.
  - Updated export paths to enhance module accessibility.

  - **Bug Fixes**

    - Fixed import paths across various modules to ensure proper module resolution.

  - **Refactor**

    - Reorganized internal file structure for improved maintainability.
    - Renamed functions to better reflect their functionality.
    - Streamlined namespace declarations for consistency.

  - **Style**

    - Adjusted import statements to use consistent file extensions.

  - **Documentation**

    - None

  - **Tests**

    - Updated test import paths to align with the new directory structure.

  - **Chores**
    - Modified build settings for the library to optimize output.

### Patch Changes

- [#56](https://github.com/kamiazya/web-csv-toolbox/pull/56) [`781bc39`](https://github.com/kamiazya/web-csv-toolbox/commit/781bc3921bc115ac138926b3aeb36cdd5a39c016) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.11 to 3.1.12

- [#64](https://github.com/kamiazya/web-csv-toolbox/pull/64) [`8b76ac2`](https://github.com/kamiazya/web-csv-toolbox/commit/8b76ac20a13411ec98f112539b733c8655455557) Thanks [@kamiazya](https://github.com/kamiazya)! - Add file inclusion patterns to biome.json

- [#55](https://github.com/kamiazya/web-csv-toolbox/pull/55) [`ca0ae5a`](https://github.com/kamiazya/web-csv-toolbox/commit/ca0ae5ad2736063068b75fa57d59c8d9a7d8d86a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @vitest/browser from 1.1.3 to 1.2.0

- [#65](https://github.com/kamiazya/web-csv-toolbox/pull/65) [`6329952`](https://github.com/kamiazya/web-csv-toolbox/commit/6329952aaddfef42c761b6752b6cde2b0daf805c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add custom file naming for different formats in vite.config.ts

- [#57](https://github.com/kamiazya/web-csv-toolbox/pull/57) [`144aff0`](https://github.com/kamiazya/web-csv-toolbox/commit/144aff084e8321aa7c77b3c501b85af250e04edd) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.1.3 to 1.2.0

- [#60](https://github.com/kamiazya/web-csv-toolbox/pull/60) [`1b6c9ca`](https://github.com/kamiazya/web-csv-toolbox/commit/1b6c9ca7b9845a987b39bf6482bfc3c30186ee72) Thanks [@kamiazya](https://github.com/kamiazya)! - Fixes a test failure in the Lexer class and improves the escapeField function.

  Additionally, the escapeField function has been refactored to handle common options and improve performance.

  The occurrences utility has also been added to count the number of occurrences of a substring in a string. These changes address the issue #54 and improve the overall reliability and efficiency of the codebase.

  - **New Features**

    - Enhanced filtering capability with validation checks.
    - Improved field escaping logic for data processing.

  - **Refactor**
    - Optimized substring occurrence calculations with caching.

- [#58](https://github.com/kamiazya/web-csv-toolbox/pull/58) [`8ae227b`](https://github.com/kamiazya/web-csv-toolbox/commit/8ae227b9878f0ae06723efa3d72b4a04d87edae3) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.27.0 to 8.27.2

## 0.5.3

### Patch Changes

- [#50](https://github.com/kamiazya/web-csv-toolbox/pull/50) [`1956d13`](https://github.com/kamiazya/web-csv-toolbox/commit/1956d13c10c2dc782f51f5645ebff6acc1f395f1) Thanks [@kamiazya](https://github.com/kamiazya)! - Update GitHub workflows and package.json

- [#53](https://github.com/kamiazya/web-csv-toolbox/pull/53) [`9ceb572`](https://github.com/kamiazya/web-csv-toolbox/commit/9ceb5726aa3bf1d6e584bd68c167a91e46d6ebb6) Thanks [@kamiazya](https://github.com/kamiazya)! - This pull request integrates Deno, Node.js, and Browsers CI workflows as CI and adds Release and Prerelease workflows as CD. It also includes the integration of the doc workflow to the CD workflow. These changes aim to improve the development and deployment processes by automating the testing, building, and releasing of the software.

  - **New Features**
    - Introduced Continuous Deployment (CD) workflow for automated build and release processes.
    - Automated package deployment to npm.
    - Automated pre-release publishing.
    - Automated deployment of documentation to GitHub Pages.
  - **Refactor**
    - Improved Continuous Integration (CI) workflow to include building and testing across different environments and platforms.
  - **Chores**
    - Updated workflow names for better clarity.

## 0.5.2

### Patch Changes

- [`61ce41e`](https://github.com/kamiazya/web-csv-toolbox/commit/61ce41eae006cae6f3260f7d8a42371edb082f40) Thanks [@kamiazya](https://github.com/kamiazya)! - Update Release

## 0.5.1

### Patch Changes

- [#47](https://github.com/kamiazya/web-csv-toolbox/pull/47) [`8c7b4f8`](https://github.com/kamiazya/web-csv-toolbox/commit/8c7b4f8ae6b535489a002fa048b5a8c77b14072a) Thanks [@kamiazya](https://github.com/kamiazya)! - Create SECURITY.md

- [#42](https://github.com/kamiazya/web-csv-toolbox/pull/42) [`9274c24`](https://github.com/kamiazya/web-csv-toolbox/commit/9274c24a9e0670a10837255fdda95866031ac9f8) Thanks [@kamiazya](https://github.com/kamiazya)! - Implemented a new build configuration using Vite for enhanced development experience.

- [#40](https://github.com/kamiazya/web-csv-toolbox/pull/40) [`f0b4fa9`](https://github.com/kamiazya/web-csv-toolbox/commit/f0b4fa9eb57a68ba38223d5d85a829671b379df3) Thanks [@kamiazya](https://github.com/kamiazya)! - Reorder exports in package.json

- [#45](https://github.com/kamiazya/web-csv-toolbox/pull/45) [`0032e9b`](https://github.com/kamiazya/web-csv-toolbox/commit/0032e9bf8766f3f40256ae8427c29abe349a8e85) Thanks [@kamiazya](https://github.com/kamiazya)! - Create CODE_OF_CONDUCT.md

- [#43](https://github.com/kamiazya/web-csv-toolbox/pull/43) [`181f229`](https://github.com/kamiazya/web-csv-toolbox/commit/181f2292cb1e99a09fc40df5ea634cec8a618dc9) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix typedoc config

- [#48](https://github.com/kamiazya/web-csv-toolbox/pull/48) [`81baca5`](https://github.com/kamiazya/web-csv-toolbox/commit/81baca57fda4c0203bc8c23a9ee7b4bf02fea1fb) Thanks [@kamiazya](https://github.com/kamiazya)! - Update web-csv-toolbox badges and import statement

## 0.5.0

### Minor Changes

- [`c9c5d8b`](https://github.com/kamiazya/web-csv-toolbox/commit/c9c5d8bbcb895878b051d118d0fb18269f5d51f6) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactoring

  - **New Features**

    - Introduced `Lexer`, `RecordAssembler`, and `LexerTransformer` classes to enhance CSV parsing capabilities.
    - Added new methods (`toArraySync`, `toIterableIterator`, `toStream`) across various modules for flexible data processing.
    - Expanded `parseArrayBuffer`, `parseResponse`, `parseString`, and `parseUint8Array` with additional output formats.

  - **Bug Fixes**

    - Corrected typos in several modules, changing `quate` to `quote` and `demiliter` to `delimiter`.
    - Allowed `undefined` values in `CSVRecord` type to improve data handling.

  - **Refactor**

    - Simplified constructors and updated logic in `LexerTransformer` and `RecordAssemblerTransformer`.
    - Enhanced type safety with refactored token types in common types module.

  - **Tests**

    - Added and refactored test cases for `Lexer`, `RecordAssembler`, `LexerTransformer`, and `escapeField` to ensure reliability.

  - **Documentation**
    - Updated descriptions and examples for new methods in various modules to assist users in understanding their usage.

### Patch Changes

- [#34](https://github.com/kamiazya/web-csv-toolbox/pull/34) [`7b13862`](https://github.com/kamiazya/web-csv-toolbox/commit/7b1386211e7ee76d33d8f047079d068419461822) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.1.1 to 1.1.3

- [#33](https://github.com/kamiazya/web-csv-toolbox/pull/33) [`3d8f97a`](https://github.com/kamiazya/web-csv-toolbox/commit/3d8f97a7c40b630e1424fbebe827b2c9fe336ec4) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump rollup from 4.9.1 to 4.9.4

- [#36](https://github.com/kamiazya/web-csv-toolbox/pull/36) [`1a72392`](https://github.com/kamiazya/web-csv-toolbox/commit/1a7239260985b29763da8c79c979fdbdd0aeef4c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc from 0.25.6 to 0.25.7

- [#35](https://github.com/kamiazya/web-csv-toolbox/pull/35) [`3b93b38`](https://github.com/kamiazya/web-csv-toolbox/commit/3b93b3829b79a2fc81718ee7d7f9bc430a609868) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.10 to 3.1.11

- [#37](https://github.com/kamiazya/web-csv-toolbox/pull/37) [`476fa06`](https://github.com/kamiazya/web-csv-toolbox/commit/476fa0659e6b3b0c78c9c97832d26f8a73aa25f1) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @vitest/browser from 1.1.1 to 1.1.3

## 0.4.0

### Minor Changes

- [#30](https://github.com/kamiazya/web-csv-toolbox/pull/30) [`9f9117b`](https://github.com/kamiazya/web-csv-toolbox/commit/9f9117b133085cb2f54458870088626607ab21fb) Thanks [@kamiazya](https://github.com/kamiazya)! - - **New Features**

  - Introduced support for `Uint8Array` and `ArrayBuffer` input parameters for CSV parsing.
  - Added new parsing functions for `Uint8Array` and `ArrayBuffer` inputs.
  - Enhanced parsing capabilities to handle various CSV data representations.

  - **Documentation**

    - Updated README to reflect support for new input types and parsing functions.

  - **Tests**

    - Added test suites for `parseArrayBuffer`, `parseUint8Array`, and `parseUint8ArrayStream` functions.

  - **Refactor**

    - Renamed `parseBinaryStream` to `parseUint8ArrayStream`.
    - Updated exported symbols and namespaces to align with the new functionality.
    - Modified existing parsing functions to accommodate new CSV data types.

  - **Style**
    - Adjusted enumerable and read-only property definitions using `Object.defineProperty` for consistency across namespaces.

## 0.3.2

### Patch Changes

- [`9ef79d2`](https://github.com/kamiazya/web-csv-toolbox/commit/9ef79d2a1286821580c974e1393ad464ffdb1343) Thanks [@kamiazya](https://github.com/kamiazya)! - Enhanced the extractQuotedString method in text processing to handle specific conditions more accurately.

- [#27](https://github.com/kamiazya/web-csv-toolbox/pull/27) [`196d562`](https://github.com/kamiazya/web-csv-toolbox/commit/196d56226afcedf054476955f9b3fbc9745a4efc) Thanks [@dependabot](https://github.com/apps/dependabot)! - Some devDependencies updates.

## 0.3.1

### Patch Changes

- [#21](https://github.com/kamiazya/web-csv-toolbox/pull/21) [`e5480ba`](https://github.com/kamiazya/web-csv-toolbox/commit/e5480bacddf29b6cce7c1f0b8d426c99f5c9e0ba) Thanks [@kamiazya](https://github.com/kamiazya)! - fix: add instalation docs for CSN and Deno

- [#19](https://github.com/kamiazya/web-csv-toolbox/pull/19) [`5f0b861`](https://github.com/kamiazya/web-csv-toolbox/commit/5f0b86110b92f6e2c8b747341e424f6a7944d57b) Thanks [@kamiazya](https://github.com/kamiazya)! - Cross platform tests

## 0.3.0

### Minor Changes

- [#18](https://github.com/kamiazya/web-csv-toolbox/pull/18) [`cd5b9b9`](https://github.com/kamiazya/web-csv-toolbox/commit/cd5b9b9959039ac3e89e5e00a1a46614266ee882) Thanks [@kamiazya](https://github.com/kamiazya)! - feat: add support cdn

### Patch Changes

- [#16](https://github.com/kamiazya/web-csv-toolbox/pull/16) [`d8cbb1f`](https://github.com/kamiazya/web-csv-toolbox/commit/d8cbb1fc8e03fe5ee5986721a8b52378894f37bc) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: fix snapshot release flow

## 0.2.0

### Minor Changes

- [#14](https://github.com/kamiazya/web-csv-toolbox/pull/14) [`8f2590e`](https://github.com/kamiazya/web-csv-toolbox/commit/8f2590e188f085808df05d5651f4999f86c4b22c) Thanks [@kamiazya](https://github.com/kamiazya)! - - Add more detailed documents.
  - Fixed a naming conventions problem in the documentation.
    - Changed `streamingParse` to `parseString`.

## 0.1.0

### Minor Changes

- [#12](https://github.com/kamiazya/web-csv-toolbox/pull/12) [`50475b3`](https://github.com/kamiazya/web-csv-toolbox/commit/50475b3f6be49e52a646eed389e72fe6efe0140d) Thanks [@kamiazya](https://github.com/kamiazya)! - doc: Publish TypeDoc to GitHub Pages

### Patch Changes

- [#11](https://github.com/kamiazya/web-csv-toolbox/pull/11) [`b48c782`](https://github.com/kamiazya/web-csv-toolbox/commit/b48c7829e5e3af1e986b3c32ffc12f41bab78e99) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: add snapshot release

- [#6](https://github.com/kamiazya/web-csv-toolbox/pull/6) [`e183d61`](https://github.com/kamiazya/web-csv-toolbox/commit/e183d619c34cdcc6c9317454f7b84b02c8ba8e59) Thanks [@kamiazya](https://github.com/kamiazya)! - Create dependabot.yml

- [#13](https://github.com/kamiazya/web-csv-toolbox/pull/13) [`761c533`](https://github.com/kamiazya/web-csv-toolbox/commit/761c5336d410a1f288f844bc1f248fc4abc19fd7) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: add GitHub Release after release

## 0.0.2

### Patch Changes

- 4be404f: ci: add build step before release

## 0.0.1

### Patch Changes

- 5402d6a: Initial Release for `web-csv-toolbox`, what is A CSV Toolbox utilizing Web Standard APIs.

  ## Key concepts

  - Web Standards first.
    - Using the [Web Streams API](https://streams.spec.whatwg.org/).
  - TypeScript friendly & User friendly.
    - Fully typed and documented.
  - Zero dependencies.
    - Using only Web Standards APIs.
  - Property-based testing.
    - Using [fast-check](https://fast-check.dev/) and [vitest](https://vitest.dev).
  - **To Be Tested** Cross platform.
    - Works on browsers and Node.js, Deno
      - Only web standard APIs are used, so it should work with these Runtimes.

  ## Key features

  - Parses CSV files using the [WHATWG Streams API](https://streams.spec.whatwg.org/).
  - Supports parsing CSV files from strings, `ReadableStream`s, and `Response` objects.
  - Supports parsing CSV files with different delimiters and quotation characters.
    - Defaults to `,` and `"` respectively.
    - Supports parsing TSV files by setting `delimiter` to `\t`.
    - Supports parsing with multi-character/multi-byte delimiters and quotation characters.
  - Supports parsing binary CSV files.
