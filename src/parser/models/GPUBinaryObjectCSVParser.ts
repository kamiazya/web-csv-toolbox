import { convertBinaryToUint8Array } from "@/converters/binary/convertBinaryToUint8Array.ts";
import type {
  BinaryCSVProcessingOptions,
  CSVParserParseOptions,
  CSVRecord,
} from "@/core/types.ts";
import {
  type CSVIndexerBackendAsync,
  CSVSeparatorIndexerAsync,
} from "@/parser/indexer/CSVSeparatorIndexerAsync.ts";
import {
  createAssemblerState,
  type DirectAssemblerConfig,
  type DirectAssemblerState,
  flushObjectRecord,
  separatorsToObjectRecords,
} from "@/parser/utils/directRecordAssembler.ts";
import { hasBOM } from "@/utils/binary/bom.ts";

/**
 * GPU-accelerated Binary CSV Parser for object output format.
 *
 * Uses WebGPU for separator detection and direct separator-to-record conversion
 * for high performance, bypassing Token object creation entirely.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements an async parser using WebGPU for CSV scanning and
 * direct record assembly. The backend must be initialized before creating this parser.
 *
 * **Performance:**
 * - Throughput: ~12.1 MB/s (consistent across file sizes)
 * - Speedup: 1.44-1.50× over CPU streaming
 * - Setup overhead: ~8ms (significant for small files <1MB)
 *
 * **Optimal for:**
 * - Files >100MB with streaming required
 * - Memory-constrained environments
 *
 * **Not recommended for:**
 * - Files <1MB (100× slower due to GPU setup overhead)
 * - Small/medium files where sync APIs are available
 *
 * @example
 * ```ts
 * import { GPUIndexerBackend, GPUBinaryObjectCSVParser } from 'web-csv-toolbox';
 *
 * const backend = new GPUIndexerBackend({
 *   chunkSize: 1024 * 1024, // 1MB
 * });
 * await backend.initialize();
 *
 * const parser = new GPUBinaryObjectCSVParser({
 *   header: ['name', 'age'] as const,
 * }, backend);
 *
 * const encoder = new TextEncoder();
 * for await (const record of parser.parse(encoder.encode('Alice,30\\nBob,25'))) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 *
 * await backend.destroy(); // Clean up GPU resources
 * ```
 */
export class GPUBinaryObjectCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  private readonly indexer: CSVSeparatorIndexerAsync;
  private readonly decoder: TextDecoder;
  private readonly config: DirectAssemblerConfig<Header>;
  private readonly ignoreBOM: boolean;
  private state: DirectAssemblerState;
  private isFirstChunk = true;

  constructor(
    options: BinaryCSVProcessingOptions<Header>,
    backend: CSVIndexerBackendAsync,
  ) {
    this.indexer = new CSVSeparatorIndexerAsync(backend);

    // Build TextDecoder options
    const decoderOptions: TextDecoderOptions = {};
    if (options.fatal !== undefined) decoderOptions.fatal = options.fatal;
    if (options.ignoreBOM !== undefined)
      decoderOptions.ignoreBOM = options.ignoreBOM;
    this.decoder = new TextDecoder("utf-8", decoderOptions);
    this.ignoreBOM = options.ignoreBOM ?? false;

    // Build config from options
    this.config = {
      header: options.header,
      quotation: options.quotation,
      columnCountStrategy: options.columnCountStrategy ?? "pad",
      skipEmptyLines: options.skipEmptyLines,
      maxFieldCount: options.maxFieldCount,
      source: options.source,
    };

    // Initialize state
    this.state = createAssemblerState(this.config);
  }

  /**
   * Parse a chunk of CSV binary data (async)
   *
   * Uses WebGPU for separator detection with two-pass algorithm:
   * - Pass 1: Collect quote parity per workgroup
   * - CPU: Compute prefix XOR across workgroups
   * - Pass 2: Detect separators using CPU-computed quote state
   *
   * @param chunk - CSV binary chunk (BufferSource) to parse (optional for flush)
   * @param options - Parse options including stream mode
   * @returns Async iterable iterator of parsed CSV records as objects
   *
   * @example Streaming
   * ```typescript
   * const backend = new GPUIndexerBackend();
   * await backend.initialize();
   * const parser = new GPUBinaryObjectCSVParser({ header: ['a', 'b'] }, backend);
   *
   * for await (const chunk of readableStream) {
   *   for await (const record of parser.parse(chunk, { stream: true })) {
   *     console.log(record); // { a: '...', b: '...' }
   *   }
   * }
   * // Flush remaining data
   * for await (const record of parser.parse()) {
   *   console.log(record);
   * }
   * ```
   */
  async *parse(
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): AsyncIterableIterator<CSVRecord<Header, "object">> {
    const stream = options?.stream ?? false;

    if (chunk === undefined) {
      // Flush mode: process remaining data
      yield* this.flush();
      return;
    }

    // Convert BufferSource to Uint8Array
    let data = convertBinaryToUint8Array(chunk);

    // Handle BOM on first chunk (skip if ignoreBOM is true)
    if (this.isFirstChunk) {
      if (!this.ignoreBOM && hasBOM(data)) {
        data = data.subarray(3); // Use subarray for zero-copy
      }
      this.isFirstChunk = false;
    }

    // Skip empty chunks
    if (data.length === 0) {
      return;
    }

    // Get separators from GPU via async indexer
    const indexResult = await this.indexer.index(data, { stream });

    if (indexResult.sepCount === 0 && indexResult.processedBytes === 0) {
      // No separators found, nothing to yield yet
      return;
    }

    // Decode processed bytes to string
    // Optimization: use subarray (zero-copy view) instead of slice
    const csvString =
      indexResult.processedBytes === data.length
        ? this.decoder.decode(data)
        : this.decoder.decode(data.subarray(0, indexResult.processedBytes));

    // Direct conversion to records (with extended format if available)
    // Note: separatorsToObjectRecords is a sync generator, so we use yield*
    yield* separatorsToObjectRecords(
      indexResult.separators,
      indexResult.sepCount,
      csvString,
      this.config,
      this.state,
      indexResult.unescapeFlags,
    );

    // Reset field tracking for next chunk
    this.state.fieldStart = 0;
  }

  /**
   * Flush remaining data and yield final records (async)
   *
   * Processes any leftover bytes that haven't been fully processed yet.
   * Call this after all chunks have been processed to ensure all records are yielded.
   *
   * @example
   * ```typescript
   * // After streaming all chunks
   * for await (const record of parser.parse()) {
   *   console.log(record); // Final records from leftover data
   * }
   * ```
   */
  private async *flush(): AsyncGenerator<
    CSVRecord<Header, "object">,
    void,
    void
  > {
    // Flush indexer to get remaining separators (async)
    const indexResult = await this.indexer.index();

    if (indexResult.sepCount > 0 || indexResult.processedBytes > 0) {
      // Get leftover data that was processed
      const leftoverBytes = this.indexer.getLeftover();
      const csvString = this.decoder.decode(
        leftoverBytes.subarray(0, indexResult.processedBytes),
      );

      if (csvString.length > 0) {
        yield* separatorsToObjectRecords(
          indexResult.separators,
          indexResult.sepCount,
          csvString,
          this.config,
          this.state,
          indexResult.unescapeFlags,
        );
      }
    }

    // Yield any final incomplete record
    yield* flushObjectRecord(this.config, this.state);

    // Reset state for potential reuse
    this.state = createAssemblerState(this.config);
    this.isFirstChunk = true;
  }

  /**
   * Reset the parser state
   *
   * Call this to start processing a new file or stream.
   * Resets internal state including the indexer and assembler state.
   *
   * @example
   * ```typescript
   * parser.reset();
   * // Now parser is ready for a new CSV stream
   * ```
   */
  reset(): void {
    this.indexer.reset();
    this.state = createAssemblerState(this.config);
    this.isFirstChunk = true;
  }
}
