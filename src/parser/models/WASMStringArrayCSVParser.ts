import type {
  CSVArrayRecord,
  CSVParserParseOptions,
  StringArrayCSVParser,
  StringCSVProcessingOptions,
} from "@/core/types.ts";
import type { CSVIndexerBackendSync } from "@/parser/indexer/CSVSeparatorIndexer.ts";
import { WASMBinaryArrayCSVParser } from "@/parser/models/WASMBinaryArrayCSVParser.ts";

/**
 * WASM-accelerated String CSV Parser for array output format.
 *
 * Uses composition to delegate to WASMBinaryArrayCSVParser after encoding
 * string input to UTF-8. This provides WASM SIMD acceleration for string input
 * with minimal code duplication.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements StringArrayCSVParser interface by:
 * 1. Accepting string input in parse()
 * 2. Encoding to UTF-8 with TextEncoder
 * 3. Delegating to WASMBinaryArrayCSVParser
 *
 * Performance: ~4.7x faster than Token-based JavaScript approach
 *
 * @example
 * ```ts
 * import { loadWASMSync, WASMIndexerBackend } from 'web-csv-toolbox';
 *
 * loadWASMSync();
 * const backend = new WASMIndexerBackend(44);
 * await backend.initialize();
 *
 * const parser = new WASMStringArrayCSVParser({
 *   header: ['name', 'age'] as const,
 * }, backend);
 *
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // ['Alice', '30']
 * }
 * ```
 */
export class WASMStringArrayCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements StringArrayCSVParser<Header>
{
  private readonly binaryParser: WASMBinaryArrayCSVParser<Header>;
  private readonly encoder = new TextEncoder();

  /**
   * Create a new WASM String Array CSV Parser.
   *
   * @param options - CSV processing options
   * @param backend - WASM indexer backend (must be initialized)
   */
  constructor(
    options: StringCSVProcessingOptions<Header>,
    backend: CSVIndexerBackendSync,
  ) {
    this.binaryParser = new WASMBinaryArrayCSVParser(options, backend);
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
