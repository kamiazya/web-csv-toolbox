import { convertBinaryToUint8Array } from "@/converters/binary/convertBinaryToUint8Array.ts";
import type {
  BinaryObjectCSVParser,
  CSVObjectRecord,
  CSVParserOptions,
  CSVParserParseOptions,
} from "@/core/types.ts";
import { flatToObjects } from "@/parser/utils/flatToObjects.ts";
import { WASMBinaryCSVParserBase } from "./WASMBinaryCSVParserBase.js";

/**
 * WASM-based CSV Parser for binary (BufferSource) input that returns object records.
 *
 * This parser uses WebAssembly with Truly Flat optimization for high-performance
 * CSV parsing. It implements the {@link BinaryObjectCSVParser} interface.
 *
 * **Performance**: 16-31% faster than legacy WASM parsing with 99.8% reduction
 * in WASM↔JS boundary crossings.
 *
 * @template Header - Array of header field names
 *
 * @example Basic usage
 * ```typescript
 * import { loadWASM, WASMBinaryObjectCSVParser } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const parser = new WASMBinaryObjectCSVParser({ delimiter: ',' });
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
 * const parser = new WASMBinaryObjectCSVParser();
 * const encoder = new TextEncoder();
 *
 * for (const record of parser.parse(encoder.encode("id,name\n1,Alice\n2,"), { stream: true })) {
 *   console.log(record); // { id: '1', name: 'Alice' }
 * }
 *
 * for (const record of parser.parse()) {
 *   console.log(record); // { id: '2', name: 'Bob' } (flushed)
 * }
 * ```
 */
export class WASMBinaryObjectCSVParser<
    Header extends ReadonlyArray<string> = readonly string[],
  >
  extends WASMBinaryCSVParserBase<Header>
  implements BinaryObjectCSVParser<Header>
{
  /**
   * Create a new WASM Binary CSV Parser that returns object records.
   *
   * @param options - Parser options
   */
  constructor(options: CSVParserOptions<Header> = {}) {
    super(options);
  }

  /**
   * Parse a chunk of CSV binary data into object records.
   *
   * @param chunk - CSV binary chunk (BufferSource) to parse (optional for flush)
   * @param options - Parse options
   * @returns Iterable iterator of parsed CSV records as objects
   */
  *parse(
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVObjectRecord<Header>> {
    const { stream = false } = options ?? {};

    if (chunk === undefined) {
      // Flush mode - use flat flush for consistent output format
      const flushed = this.flushFlat();
      yield* flatToObjects<Header>(flushed);
      return;
    }

    const bytes = convertBinaryToUint8Array(chunk);

    if (stream) {
      // Streaming mode - process chunk using Truly Flat
      const flatData = this.parseFlatChunk(bytes);
      yield* flatToObjects<Header>(flatData);
    } else {
      // Final chunk mode - process and flush
      const flatData = this.parseFlatChunk(bytes);
      yield* flatToObjects<Header>(flatData);

      const flushed = this.flushFlat();
      yield* flatToObjects<Header>(flushed);
    }
  }
}
