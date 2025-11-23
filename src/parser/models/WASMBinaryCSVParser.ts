import type {
  BinaryObjectCSVParser,
  CSVObjectRecord,
  CSVParserOptions,
  CSVParserParseOptions,
} from "@/core/types.ts";
import { CSVParser as WASMCSVParserInternal } from "web-csv-toolbox-wasm";

/**
 * WASM-based CSV Parser for binary (BufferSource) input that returns object records.
 *
 * This parser uses WebAssembly for high-performance CSV parsing.
 * It implements the {@link BinaryObjectCSVParser} interface and can process CSV data
 * incrementally (streaming) or in a single pass.
 *
 * This parser accepts BufferSource (Uint8Array, ArrayBuffer, etc.) chunks directly,
 * eliminating the overhead of TextDecoder and providing better performance for
 * binary data sources.
 *
 * **Performance**: Approximately 8-30% faster than string-based WASM parsing for
 * binary sources like fetch() responses.
 *
 * @template Header - Array of header field names
 *
 * @example Basic usage
 * ```typescript
 * import { loadWASM, WASMBinaryCSVParser } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const parser = new WASMBinaryCSVParser({ delimiter: ',' });
 * const encoder = new TextEncoder();
 * const bytes = encoder.encode("id,name\n1,Alice\n2,Bob");
 *
 * for (const record of parser.parse(bytes)) {
 *   console.log(record); // { id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }
 * }
 * ```
 *
 * @example Streaming usage
 * ```typescript
 * const parser = new WASMBinaryCSVParser();
 * const encoder = new TextEncoder();
 *
 * // Process chunks as they arrive
 * for (const record of parser.parse(encoder.encode("id,name\n1,Alice\n2,"), { stream: true })) {
 *   console.log(record); // { id: '1', name: 'Alice' }
 * }
 *
 * for (const record of parser.parse(encoder.encode("Bob\n3,Carol"), { stream: true })) {
 *   console.log(record); // { id: '2', name: 'Bob' }
 * }
 *
 * // Flush remaining data
 * for (const record of parser.parse()) {
 *   console.log(record); // { id: '3', name: 'Carol' }
 * }
 * ```
 *
 * @example With fetch API
 * ```typescript
 * const parser = new WASMBinaryCSVParser();
 * const response = await fetch('data.csv');
 * const reader = response.body!.getReader();
 *
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) {
 *     for (const record of parser.parse()) { // Flush
 *       console.log(record);
 *     }
 *     break;
 *   }
 *   for (const record of parser.parse(value, { stream: true })) {
 *     console.log(record);
 *   }
 * }
 * ```
 */
export class WASMBinaryCSVParser<
  Header extends ReadonlyArray<string> = readonly string[],
> implements BinaryObjectCSVParser<Header>
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
   * Parse a chunk of CSV binary data into object records.
   *
   * When called with a chunk and `{ stream: true }`, the parser processes the chunk
   * and returns completed records, keeping incomplete data in an internal buffer.
   *
   * When called with a chunk and `{ stream: false }` (or omitted), the parser
   * processes the chunk as the final one and flushes all remaining data.
   *
   * When called without a chunk, flushes any remaining buffered data.
   *
   * @param chunk - CSV binary chunk (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray) to parse (optional for flush)
   * @param options - Parse options
   * @returns Iterable iterator of parsed CSV records as objects
   *
   * @example Streaming mode
   * ```typescript
   * const parser = new WASMBinaryCSVParser();
   * const encoder = new TextEncoder();
   *
   * for (const record of parser.parse(encoder.encode("id,name\n1,Alice\n2,"), { stream: true })) {
   *   console.log(record); // { id: '1', name: 'Alice' }
   * }
   * // "2," is buffered
   *
   * for (const record of parser.parse(encoder.encode("Bob"), { stream: false })) {
   *   console.log(record); // { id: '2', name: 'Bob' }
   * }
   * ```
   *
   * @example Flush mode
   * ```typescript
   * const parser = new WASMBinaryCSVParser();
   * const encoder = new TextEncoder();
   *
   * parser.parse(encoder.encode("id,name\n1,"), { stream: true }); // "1," buffered
   *
   * for (const record of parser.parse()) { // Flush
   *   console.log(record); // { id: '1', name: '' }
   * }
   * ```
   */
  *parse(
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVObjectRecord<Header>> {
    const { stream = false } = options ?? {};

    // Convert BufferSource to Uint8Array
    let bytes: Uint8Array | undefined;
    if (chunk !== undefined) {
      if (chunk instanceof Uint8Array) {
        bytes = chunk;
      } else if (chunk instanceof ArrayBuffer) {
        bytes = new Uint8Array(chunk);
      } else if (ArrayBuffer.isView(chunk)) {
        // TypedArray
        bytes = new Uint8Array(
          chunk.buffer,
          chunk.byteOffset,
          chunk.byteLength,
        );
      } else {
        throw new Error("chunk must be a BufferSource (Uint8Array, ArrayBuffer, or TypedArray)");
      }
    }

    if (bytes === undefined) {
      // Flush mode
      const result = this.#parser.flush();
      if (Array.isArray(result)) {
        yield* result as CSVObjectRecord<Header>[];
      }
      return;
    }

    if (stream) {
      // Streaming mode - process chunk and keep buffer
      const result = this.#parser.processChunkBytes(bytes);
      if (Array.isArray(result)) {
        yield* result as CSVObjectRecord<Header>[];
      }
    } else {
      // Final chunk mode - process and flush
      const records1 = this.#parser.processChunkBytes(bytes);
      if (Array.isArray(records1)) {
        yield* records1 as CSVObjectRecord<Header>[];
      }

      const records2 = this.#parser.flush();
      if (Array.isArray(records2)) {
        yield* records2 as CSVObjectRecord<Header>[];
      }
    }
  }
}
