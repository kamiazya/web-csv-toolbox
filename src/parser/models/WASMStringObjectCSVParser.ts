import type {
  CSVObjectRecord,
  CSVParserParseOptions,
  StringCSVProcessingOptions,
  StringObjectCSVParser,
} from "@/core/types.ts";
import type { CSVIndexerBackendSync } from "@/parser/indexer/CSVSeparatorIndexer.ts";
import { WASMBinaryObjectCSVParser } from "@/parser/models/WASMBinaryObjectCSVParser.ts";

/**
 * WASM-accelerated String CSV Parser for object output format.
 *
 * Uses composition to delegate to WASMBinaryObjectCSVParser after encoding
 * string input to UTF-8. This provides WASM SIMD acceleration for string input
 * with minimal code duplication.
 *
 * @template Header - The type of the header row
 *
 * @remarks
 * This class implements StringObjectCSVParser interface by:
 * 1. Accepting string input in parse()
 * 2. Encoding to UTF-8 with TextEncoder
 * 3. Delegating to WASMBinaryObjectCSVParser
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
 * const parser = new WASMStringObjectCSVParser({
 *   header: ['name', 'age'] as const,
 * }, backend);
 *
 * for (const record of parser.parse('Alice,30\nBob,25')) {
 *   console.log(record); // { name: 'Alice', age: '30' }
 * }
 * ```
 */
export class WASMStringObjectCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements StringObjectCSVParser<Header>
{
  private readonly binaryParser: WASMBinaryObjectCSVParser<Header>;
  private readonly encoder = new TextEncoder();

  /**
   * Create a new WASM String Object CSV Parser.
   *
   * @param options - CSV processing options
   * @param backend - WASM indexer backend (must be initialized)
   */
  constructor(
    options: StringCSVProcessingOptions<Header>,
    backend: CSVIndexerBackendSync,
  ) {
    this.binaryParser = new WASMBinaryObjectCSVParser(options, backend);
  }

  /**
   * Parse a chunk of CSV string data into object records.
   *
   * @param chunk - CSV string chunk to parse (optional for flush)
   * @param options - Parse options including stream mode
   * @returns Iterable iterator of parsed CSV records as objects
   */
  *parse(
    chunk?: string,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVObjectRecord<Header>> {
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
