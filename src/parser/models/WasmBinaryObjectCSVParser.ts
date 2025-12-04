import { convertBinaryToUint8Array } from "@/converters/binary/convertBinaryToUint8Array.ts";
import type {
  BinaryCSVProcessingOptions,
  BinaryObjectCSVParser,
  CSVParserParseOptions,
  CSVRecord,
} from "@/core/types.ts";
import {
  type CSVIndexerBackendSync,
  CSVSeparatorIndexer,
} from "@/parser/indexer/CSVSeparatorIndexer.ts";
import {
  createAssemblerState,
  type DirectAssemblerConfig,
  type DirectAssemblerState,
  flushObjectRecord,
  separatorsToObjectRecords,
} from "@/parser/utils/directRecordAssembler.ts";
import { hasBOM } from "@/utils/binary/bom.ts";

/**
 * Wasm-accelerated Binary CSV Parser for object output format.
 *
 * Uses direct separator-to-record conversion for high performance,
 * bypassing Token object creation entirely.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements BinaryObjectCSVParser interface using Wasm SIMD
 * for CSV scanning and direct record assembly. The backend must be
 * initialized before creating this parser.
 *
 * Performance: ~5x faster than Token-based approach (100+ MB/s vs 21 MB/s)
 *
 * @example
 * ```ts
 * import { loadWasmSync, WasmIndexerBackend } from 'web-csv-toolbox';
 *
 * loadWasmSync();
 * const backend = new WasmIndexerBackend(44);
 * await backend.initialize();
 *
 * const parser = new WasmBinaryObjectCSVParser({
 *   header: ['name', 'age'] as const,
 * }, backend);
 *
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\\nBob,25'))) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 */
export class WasmBinaryObjectCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements BinaryObjectCSVParser<Header>
{
  private readonly indexer: CSVSeparatorIndexer;
  private readonly decoder: TextDecoder;
  private readonly config: DirectAssemblerConfig<Header>;
  private readonly ignoreBOM: boolean;
  private state: DirectAssemblerState;
  private isFirstChunk = true;

  constructor(
    options: BinaryCSVProcessingOptions<Header>,
    backend: CSVIndexerBackendSync,
  ) {
    this.indexer = new CSVSeparatorIndexer(backend);

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
   * Parse a chunk of CSV binary data
   *
   * @param chunk - CSV binary chunk (BufferSource) to parse (optional for flush)
   * @param options - Parse options including stream mode
   * @returns Iterable iterator of parsed CSV records as objects
   */
  *parse(
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVRecord<Header, "object">> {
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

    // Get separators from Wasm via indexer
    const indexResult = this.indexer.index(data, { stream });

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
   * Flush remaining data and yield final records.
   */
  private *flush(): Generator<CSVRecord<Header, "object">, void, void> {
    // Flush indexer to get remaining separators
    const indexResult = this.indexer.index();

    if (indexResult.sepCount > 0 || indexResult.processedBytes > 0) {
      // Get leftover data that was processed
      const csvString = this.decoder.decode(
        new Uint8Array(indexResult.processedBytes),
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

    // Flush any remaining partial record
    yield* flushObjectRecord(this.config, this.state);

    // Reset state for potential reuse
    this.state = createAssemblerState(this.config);
    this.isFirstChunk = true;
  }
}
