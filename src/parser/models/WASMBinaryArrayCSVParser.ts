import { convertBinaryToUint8Array } from "@/converters/binary/convertBinaryToUint8Array.ts";
import type {
  BinaryArrayCSVParser,
  BinaryCSVProcessingOptions,
  CSVParserParseOptions,
  CSVRecord,
} from "@/core/types.ts";
import {
  CSVSeparatorIndexer,
  type CSVIndexerBackendSync,
} from "@/parser/indexer/CSVSeparatorIndexer.ts";
import {
  type DirectAssemblerConfig,
  type DirectAssemblerState,
  createAssemblerState,
  flushArrayRecord,
  separatorsToArrayRecords,
} from "@/parser/utils/directRecordAssembler.ts";
import { hasBOM } from "@/utils/binary/bom.ts";

/**
 * WASM-accelerated Binary CSV Parser for array output format.
 *
 * Uses direct separator-to-record conversion for high performance,
 * bypassing Token object creation entirely.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements BinaryArrayCSVParser interface using WASM SIMD
 * for CSV scanning and direct record assembly. The backend must be
 * initialized before creating this parser.
 *
 * Performance: ~5x faster than Token-based approach (100+ MB/s vs 21 MB/s)
 *
 * @example
 * ```ts
 * import { loadWASMSync, WASMIndexerBackend } from 'web-csv-toolbox';
 *
 * loadWASMSync();
 * const backend = new WASMIndexerBackend(44);
 * await backend.initialize();
 *
 * const parser = new WASMBinaryArrayCSVParser({
 *   header: ['name', 'age'] as const,
 * }, backend);
 *
 * const encoder = new TextEncoder();
 * for (const record of parser.parse(encoder.encode('Alice,30\\nBob,25'))) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export class WASMBinaryArrayCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements BinaryArrayCSVParser<Header>
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
      columnCountStrategy: options.columnCountStrategy ?? "keep",
      skipEmptyLines: options.skipEmptyLines,
      includeHeader: options.includeHeader,
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
   * @returns Iterable iterator of parsed CSV records as arrays
   */
  *parse(
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVRecord<Header, "array">> {
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

    // Get separators from WASM via indexer
    const indexResult = this.indexer.index(data, { stream });

    if (indexResult.sepCount === 0 && indexResult.processedBytes === 0) {
      // No separators found, nothing to yield yet
      return;
    }

    // Decode processed bytes to string
    // Optimization: use subarray (zero-copy view) instead of slice
    const csvString = indexResult.processedBytes === data.length
      ? this.decoder.decode(data)
      : this.decoder.decode(data.subarray(0, indexResult.processedBytes));

    // Direct conversion to records (with extended format if available)
    yield* separatorsToArrayRecords(
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
  private *flush(): Generator<CSVRecord<Header, "array">, void, void> {
    // Flush indexer to get remaining separators
    const indexResult = this.indexer.index();

    if (indexResult.sepCount > 0 || indexResult.processedBytes > 0) {
      // Get leftover data that was processed
      const csvString = this.decoder.decode(
        new Uint8Array(indexResult.processedBytes),
      );

      if (csvString.length > 0) {
        yield* separatorsToArrayRecords(
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
    yield* flushArrayRecord(this.config, this.state);

    // Reset state for potential reuse
    this.state = createAssemblerState(this.config);
    this.isFirstChunk = true;
  }
}
