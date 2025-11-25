import type {
  CSVArrayRecord,
  CSVParserOptions,
  CSVParserParseOptions,
  StringArrayCSVParser,
} from "@/core/types.ts";
import {
  type FlatParseData,
  WASMStringCSVParserBase,
} from "./WASMStringCSVParserBase.js";

/**
 * WASM-based CSV Parser for string input that returns array records.
 *
 * This parser uses WebAssembly with Truly Flat optimization for high-performance
 * CSV parsing. Unlike {@link WASMStringObjectCSVParser}, this parser returns records
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
 * import { loadWASM, WASMStringCSVArrayParser } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const parser = new WASMStringCSVArrayParser<readonly ['id', 'name']>({
 *   delimiter: ','
 * });
 * const csv = "id,name\n1,Alice\n2,Bob";
 *
 * for (const record of parser.parse(csv)) {
 *   console.log(record); // ['1', 'Alice'], ['2', 'Bob']
 *   console.log(record[0]); // '1' (type-safe positional access)
 * }
 * ```
 *
 * @example Streaming usage
 * ```typescript
 * const parser = new WASMStringCSVArrayParser();
 *
 * for (const record of parser.parse("id,name\n1,Alice\n2,", { stream: true })) {
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
 * const parser = new WASMStringCSVArrayParser();
 * const data: string[][] = [];
 *
 * for (const record of parser.parse(csvString)) {
 *   data.push([...record]); // Convert to regular array if needed
 * }
 * ```
 */
export class WASMStringCSVArrayParser<
    Header extends ReadonlyArray<string> = readonly string[],
  >
  extends WASMStringCSVParserBase<Header>
  implements StringArrayCSVParser<Header>
{
  /**
   * Create a new WASM String CSV Parser that returns array records.
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
   * Parse a chunk of CSV string data into array records.
   *
   * @param chunk - CSV string chunk to parse (optional for flush)
   * @param options - Parse options
   * @returns Iterable iterator of parsed CSV records as arrays
   */
  *parse(
    chunk?: string,
    options?: CSVParserParseOptions,
  ): IterableIterator<CSVArrayRecord<Header>> {
    const { stream = false } = options ?? {};

    if (chunk === undefined) {
      // Flush mode - use legacy flush and convert to array format
      const flushed = this.flushLegacy();
      yield* this.objectsToArrays(flushed);
      return;
    }

    if (stream) {
      // Streaming mode - process chunk using Truly Flat
      const flatData = this.parseFlatChunk(chunk);
      yield* this.flatToArrays(flatData);
    } else {
      // Final chunk mode - process and flush
      const flatData = this.parseFlatChunk(chunk);
      yield* this.flatToArrays(flatData);

      const flushed = this.flushLegacy();
      yield* this.objectsToArrays(flushed);
    }
  }
}
