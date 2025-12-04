import type {
  CSVArrayRecord,
  CSVParserParseOptions,
  StringArrayCSVParser,
  StringCSVProcessingOptions,
} from "@/core/types.ts";
import type { CSVIndexerBackendSync } from "@/parser/indexer/CSVSeparatorIndexer.ts";
import { WasmBinaryArrayCSVParser } from "@/parser/models/WasmBinaryArrayCSVParser.ts";

/**
 * Wasm-accelerated String CSV Parser for array output format (UTF-8 encoding).
 *
 * Uses composition to delegate to WasmBinaryArrayCSVParser after encoding
 * string input to UTF-8. This provides Wasm SIMD acceleration for string input
 * with minimal code duplication.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements StringArrayCSVParser interface by:
 * 1. Accepting string input in parse()
 * 2. Encoding to UTF-8 with TextEncoder
 * 3. Delegating to WasmBinaryArrayCSVParser
 *
 * Performance: ~4.7x faster than Token-based JavaScript approach
 *
 * @example
 * ```ts
 * import { loadWasmSync, WasmIndexerBackend } from 'web-csv-toolbox';
 *
 * loadWasmSync();
 * const backend = new WasmIndexerBackend(44);
 * await backend.initialize();
 *
 * const parser = new WasmStringUtf8ArrayCSVParser({
 *   header: ['name', 'age'] as const,
 * }, backend);
 *
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export class WasmStringUtf8ArrayCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements StringArrayCSVParser<Header>
{
  private readonly binaryParser: WasmBinaryArrayCSVParser<Header>;
  private readonly encoder = new TextEncoder();

  /**
   * Create a new Wasm String Array CSV Parser (UTF-8).
   *
   * @param options - CSV processing options
   * @param backend - Wasm indexer backend (must be initialized)
   */
  constructor(
    options: StringCSVProcessingOptions<Header>,
    backend: CSVIndexerBackendSync,
  ) {
    this.binaryParser = new WasmBinaryArrayCSVParser(options, backend);
  }

  /**
   * Parse a chunk of CSV string data into array records.
   *
   * @param chunk - CSV string chunk to parse (optional for flush)
   * @param options - Parse options including stream mode
   * @returns Iterable iterator of parsed CSV records as arrays
   */
  *parse(
    chunk?: string,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVArrayRecord<Header>> {
    if (chunk === undefined) {
      // Flush mode: delegate to binary parser flush
      yield* this.binaryParser.parse(undefined, options);
      return;
    }

    // Encode string to UTF-8 bytes
    const bytes = this.encoder.encode(chunk);

    // Delegate to binary parser
    yield* this.binaryParser.parse(bytes, options);
  }
}
