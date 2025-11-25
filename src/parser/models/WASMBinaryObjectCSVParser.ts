import { convertBinaryToUint8Array } from "@/converters/binary/convertBinaryToUint8Array.ts";
import type {
  BinaryObjectCSVParser,
  CSVObjectRecord,
  CSVParserOptions,
  CSVParserParseOptions,
} from "@/core/types.ts";
import {
  type FlatParseData,
  WASMBinaryCSVParserBase,
} from "./WASMBinaryCSVParserBase.js";

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
   * Convert flat parse data to object records.
   * This is the JS-side assembly from intermediate flat format.
   *
   * @param data - Flat parse data from WASM
   * @returns Array of object records
   */
  private flatToObjects(data: FlatParseData): CSVObjectRecord<Header>[] {
    const { headers, fieldData, actualFieldCounts, recordCount, fieldCount } =
      data;

    if (!headers || recordCount === 0) {
      return [];
    }

    // At this point, headers is guaranteed to be non-null
    const headerArray = headers;
    const records: CSVObjectRecord<Header>[] = [];
    for (let r = 0; r < recordCount; r++) {
      const obj: Record<string, string | undefined> = {};
      // Get actual field count for this record (fields beyond this are undefined, not empty string)
      const actualCount = actualFieldCounts[r] ?? fieldCount;
      for (let f = 0; f < fieldCount; f++) {
        const headerKey = headerArray[f];
        if (headerKey !== undefined) {
          if (f < actualCount) {
            // Field exists in the record
            obj[headerKey] = fieldData[r * fieldCount + f];
          } else {
            // Field is missing - use undefined instead of empty string
            obj[headerKey] = undefined;
          }
        }
      }
      records.push(obj as CSVObjectRecord<Header>);
    }

    return records;
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
      // Flush mode - use legacy flush for remaining data
      const flushed = this.flushLegacy();
      yield* flushed as CSVObjectRecord<Header>[];
      return;
    }

    const bytes = convertBinaryToUint8Array(chunk);

    if (stream) {
      // Streaming mode - process chunk using Truly Flat
      const flatData = this.parseFlatChunk(bytes);
      yield* this.flatToObjects(flatData);
    } else {
      // Final chunk mode - process and flush
      const flatData = this.parseFlatChunk(bytes);
      yield* this.flatToObjects(flatData);

      const flushed = this.flushLegacy();
      yield* flushed as CSVObjectRecord<Header>[];
    }
  }
}
