import { CSVParser as WASMCSVParserInternal } from "web-csv-toolbox-wasm";
import type {
  BinaryCSVParser,
  CSVParserOptions,
  CSVParserParseOptions,
  CSVRecord,
} from "../../core/types.ts";

/**
 * WASM-based CSV Parser for binary (Uint8Array) input.
 *
 * This parser uses WebAssembly for high-performance CSV parsing.
 * It implements the {@link CSVParser} interface and can process CSV data
 * incrementally (streaming) or in a single pass.
 *
 * This parser accepts Uint8Array chunks directly, eliminating the overhead
 * of TextDecoder and providing better performance for binary data sources.
 *
 * @example Basic usage
 * ```ts
 * import { loadWASM, WASMBinaryCSVParser } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const parser = new WASMBinaryCSVParser({ delimiter: ',' });
 * const encoder = new TextEncoder();
 * const bytes = encoder.encode("id,name\n1,Alice\n2,Bob");
 * const records = parser.parse(bytes);
 * console.log(records);
 * // [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]
 * ```
 *
 * @example Streaming usage
 * ```ts
 * const parser = new WASMBinaryCSVParser();
 * const encoder = new TextEncoder();
 *
 * // Process chunks as they arrive
 * const records1 = parser.parse(encoder.encode("id,name\n1,Alice\n2,"), { stream: true });
 * // returns: [{ id: '1', name: 'Alice' }]
 * // "2," is buffered
 *
 * const records2 = parser.parse(encoder.encode("Bob\n3,Carol"), { stream: true });
 * // returns: [{ id: '2', name: 'Bob' }]
 * // "3,Carol" is buffered
 *
 * const records3 = parser.parse(); // Flush remaining data
 * // returns: [{ id: '3', name: 'Carol' }]
 * ```
 *
 * @example With fetch API
 * ```ts
 * const parser = new WASMBinaryCSVParser();
 * const response = await fetch('data.csv');
 * const reader = response.body.getReader();
 *
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) {
 *     const remaining = parser.parse(); // Flush
 *     console.log(remaining);
 *     break;
 *   }
 *   const records = parser.parse(value, { stream: true });
 *   console.log(records);
 * }
 * ```
 */
export class WASMBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements BinaryCSVParser<Header>
{
  #parser: WASMCSVParserInternal;

  /**
   * Create a new WASM Binary CSV Parser.
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
   * @param chunk - CSV binary chunk (Uint8Array) to parse (optional for flush)
   * @param options - Parse options
   * @returns Array of parsed CSV records
   *
   * @example Streaming mode
   * ```ts
   * const parser = new WASMBinaryCSVParser();
   * const encoder = new TextEncoder();
   * const records1 = parser.parse(encoder.encode("id,name\n1,Alice\n2,"), { stream: true });
   * // returns: [{ id: '1', name: 'Alice' }]
   * // "2," is buffered
   *
   * const records2 = parser.parse(encoder.encode("Bob"), { stream: false });
   * // returns: [{ id: '2', name: 'Bob' }]
   * ```
   *
   * @example Flush mode
   * ```ts
   * const parser = new WASMBinaryCSVParser();
   * const encoder = new TextEncoder();
   * parser.parse(encoder.encode("id,name\n1,"), { stream: true }); // "1," buffered
   * const remaining = parser.parse(); // Flush
   * // returns: [{ id: '1', name: '' }]
   * ```
   */
  parse(
    chunk?: Uint8Array,
    options?: CSVParserParseOptions,
  ): CSVRecord<Header>[] {
    const { stream = false } = options ?? {};

    if (chunk === undefined) {
      // Flush mode
      const result = this.#parser.flush();
      return result as CSVRecord<Header>[];
    }

    if (stream) {
      // Streaming mode - process chunk and keep buffer
      const result = this.#parser.processChunkBytes(chunk);
      return result as CSVRecord<Header>[];
    } else {
      // Final chunk mode - process and flush
      const records1 = this.#parser.processChunkBytes(chunk);
      const records2 = this.#parser.flush();
      return [...records1, ...records2] as CSVRecord<Header>[];
    }
  }
}
