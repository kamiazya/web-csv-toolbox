import { CSVParser as WASMCSVParserInternal } from "web-csv-toolbox-wasm";
import type {
  CSVParserOptions,
  CSVParserParseOptions,
  CSVRecord,
  StringCSVParser,
} from "../../core/types.ts";

/**
 * WASM-based CSV Parser for string input.
 *
 * This parser uses WebAssembly for high-performance CSV parsing.
 * It implements the {@link StringCSVParser} interface and can process CSV data
 * incrementally (streaming) or in a single pass.
 *
 * @example Basic usage
 * ```ts
 * import { loadWASM, WASMStringCSVParser } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const parser = new WASMStringCSVParser({ delimiter: ',' });
 * const records = parser.parse("id,name\n1,Alice\n2,Bob");
 * console.log(records);
 * // [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]
 * ```
 *
 * @example Streaming usage
 * ```ts
 * const parser = new WASMStringCSVParser();
 *
 * // Process chunks as they arrive
 * const records1 = parser.parse("id,name\n1,Alice\n2,", { stream: true });
 * // returns: [{ id: '1', name: 'Alice' }]
 * // "2," is buffered
 *
 * const records2 = parser.parse("Bob\n3,Carol", { stream: true });
 * // returns: [{ id: '2', name: 'Bob' }]
 * // "3,Carol" is buffered
 *
 * const records3 = parser.parse(); // Flush remaining data
 * // returns: [{ id: '3', name: 'Carol' }]
 * ```
 */
export class WASMStringCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements StringCSVParser<Header>
{
  #parser: WASMCSVParserInternal;

  /**
   * Create a new WASM CSV Parser.
   *
   * @param options - Parser options
   */
  constructor(options: CSVParserOptions<Header> = {}) {
    const {
      delimiter = ",",
      quotation = '"',
      maxFieldCount = 100000,
      header,
    } = options;

    if (delimiter.length !== 1) {
      throw new Error("Delimiter must be a single character");
    }

    if (quotation.length !== 1) {
      throw new Error("Quotation must be a single character");
    }

    if (maxFieldCount <= 0) {
      throw new Error("maxFieldCount must be positive");
    }

    const delimiterCode = delimiter.charCodeAt(0);
    const quotationCode = quotation.charCodeAt(0);

    // Use appropriate constructor based on options
    if (header) {
      this.#parser = WASMCSVParserInternal.withCustomHeader(
        delimiterCode,
        quotationCode,
        maxFieldCount,
        header as unknown as string[],
      );
    } else {
      this.#parser = WASMCSVParserInternal.withOptions(
        delimiterCode,
        quotationCode,
        maxFieldCount,
      );
    }
  }

  /**
   * Parse a chunk of CSV data.
   *
   * When called with a chunk and `{ stream: true }`, the parser processes the chunk
   * and returns completed records, keeping incomplete data in an internal buffer.
   *
   * When called with a chunk and `{ stream: false }` (or omitted), the parser
   * processes the chunk as the final one and flushes all remaining data.
   *
   * When called without a chunk, flushes any remaining buffered data.
   *
   * @param chunk - CSV string chunk to parse (optional for flush)
   * @param options - Parse options
   * @returns Array of parsed CSV records
   *
   * @example Streaming mode
   * ```ts
   * const parser = new WASMStringCSVParser();
   * const records1 = parser.parse("id,name\n1,Alice\n2,", { stream: true });
   * // returns: [{ id: '1', name: 'Alice' }]
   * // "2," is buffered
   *
   * const records2 = parser.parse("Bob", { stream: false });
   * // returns: [{ id: '2', name: 'Bob' }]
   * ```
   *
   * @example Flush mode
   * ```ts
   * const parser = new WASMStringCSVParser();
   * parser.parse("id,name\n1,", { stream: true }); // "1," buffered
   * const remaining = parser.parse(); // Flush
   * // returns: [{ id: '1', name: '' }]
   * ```
   */
  parse(chunk?: string, options?: CSVParserParseOptions): CSVRecord<Header>[] {
    const { stream = false } = options ?? {};

    if (chunk === undefined) {
      // Flush mode
      const result = this.#parser.flush();
      return result as CSVRecord<Header>[];
    }

    if (stream) {
      // Streaming mode - process chunk and keep buffer
      const result = this.#parser.processChunk(chunk);
      return result as CSVRecord<Header>[];
    } else {
      // Final chunk mode - process and flush
      const records1 = this.#parser.processChunk(chunk);
      const records2 = this.#parser.flush();
      return [...records1, ...records2] as CSVRecord<Header>[];
    }
  }
}
