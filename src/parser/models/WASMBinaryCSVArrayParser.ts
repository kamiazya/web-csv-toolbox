import { convertBinaryToUint8Array } from "@/converters/binary/convertBinaryToUint8Array.ts";
import type {
  BinaryArrayCSVParser,
  CSVArrayRecord,
  CSVParserOptions,
  CSVParserParseOptions,
} from "@/core/types.ts";
import {
  type FlatParseData,
  WASMBinaryCSVParserBase,
} from "./WASMBinaryCSVParserBase.js";

/**
 * WASM-based CSV Parser for binary (BufferSource) input that returns array records.
 *
 * This parser uses WebAssembly with Truly Flat optimization for high-performance
 * CSV parsing. Unlike {@link WASMBinaryObjectCSVParser}, this parser returns records
 * as arrays/tuples rather than objects, which can be more efficient when you
 * need positional access to fields.
 *
 * **Performance**: 16-31% faster than legacy WASM parsing with 99.8% reduction
 * in WASM↔JS boundary crossings. Array format may provide additional speedup
 * for certain use cases due to simpler data structure.
 *
 * @template Header - Array of header field names (determines array structure)
 *
 * @example Basic usage
 * ```typescript
 * import { loadWASM, WASMBinaryCSVArrayParser } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const parser = new WASMBinaryCSVArrayParser<readonly ['id', 'name']>({
 *   delimiter: ','
 * });
 * const encoder = new TextEncoder();
 * const bytes = encoder.encode("id,name\n1,Alice\n2,Bob");
 *
 * for (const record of parser.parse(bytes)) {
 *   console.log(record); // ['1', 'Alice'], ['2', 'Bob']
 *   console.log(record[0]); // '1' (type-safe positional access)
 * }
 * ```
 *
 * @example Streaming usage
 * ```typescript
 * const parser = new WASMBinaryCSVArrayParser();
 * const encoder = new TextEncoder();
 *
 * for (const record of parser.parse(encoder.encode("id,name\n1,Alice\n2,"), { stream: true })) {
 *   console.log(record); // ['1', 'Alice']
 * }
 *
 * for (const record of parser.parse()) {
 *   console.log(record); // ['2', 'Bob'] (flushed)
 * }
 * ```
 *
 * @example Use case: CSV to 2D array conversion
 * ```typescript
 * const parser = new WASMBinaryCSVArrayParser();
 * const data: string[][] = [];
 *
 * for (const record of parser.parse(csvBytes)) {
 *   data.push([...record]); // Convert to regular array if needed
 * }
 * ```
 */
export class WASMBinaryCSVArrayParser<
    Header extends ReadonlyArray<string> = readonly string[],
  >
  extends WASMBinaryCSVParserBase<Header>
  implements BinaryArrayCSVParser<Header>
{
  /**
   * Create a new WASM Binary CSV Parser that returns array records.
   *
   * @param options - Parser options
   */
  constructor(options: CSVParserOptions<Header> = {}) {
    super(options);
  }

  /**
   * Convert flat parse data to array records.
   * This is the JS-side assembly from intermediate flat format.
   *
   * @param data - Flat parse data from WASM
   * @returns Array of array records
   */
  private flatToArrays(data: FlatParseData): CSVArrayRecord<Header>[] {
    const { headers, fieldData, recordCount, fieldCount } = data;

    if (!headers || recordCount === 0) {
      return [];
    }

    const records: CSVArrayRecord<Header>[] = [];
    for (let r = 0; r < recordCount; r++) {
      const arr: (string | undefined)[] = [];
      for (let f = 0; f < fieldCount; f++) {
        const value = fieldData[r * fieldCount + f];
        arr.push(value);
      }
      records.push(arr as unknown as CSVArrayRecord<Header>);
    }

    return records;
  }

  /**
   * Convert legacy object records to array format
   */
  private objectsToArrays(
    objects: Record<string, string | undefined>[],
  ): CSVArrayRecord<Header>[] {
    const headers = this.getHeaders();
    if (!headers) {
      return [];
    }

    return objects.map((obj) => {
      const arr: (string | undefined)[] = [];
      for (const header of headers) {
        arr.push(obj[header]);
      }
      return arr as unknown as CSVArrayRecord<Header>;
    });
  }

  /**
   * Parse a chunk of CSV binary data into array records.
   *
   * @param chunk - CSV binary chunk (BufferSource) to parse (optional for flush)
   * @param options - Parse options
   * @returns Iterable iterator of parsed CSV records as arrays
   */
  *parse(
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVArrayRecord<Header>> {
    const { stream = false } = options ?? {};

    if (chunk === undefined) {
      // Flush mode - use legacy flush and convert to array format
      const flushed = this.flushLegacy();
      yield* this.objectsToArrays(flushed);
      return;
    }

    const bytes = convertBinaryToUint8Array(chunk);

    if (stream) {
      // Streaming mode - process chunk using Truly Flat
      const flatData = this.parseFlatChunk(bytes);
      yield* this.flatToArrays(flatData);
    } else {
      // Final chunk mode - process and flush
      const flatData = this.parseFlatChunk(bytes);
      yield* this.flatToArrays(flatData);

      const flushed = this.flushLegacy();
      yield* this.objectsToArrays(flushed);
    }
  }
}
