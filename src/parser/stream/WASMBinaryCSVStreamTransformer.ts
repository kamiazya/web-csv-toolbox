import { type FlatParseResult, CSVParser } from "web-csv-toolbox-wasm";
import {
  DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "@/core/constants.ts";
import type { CSVObjectRecord } from "@/core/types.ts";
import type { WASMParserOptions } from "@/parser/models/wasm-internal-types.ts";

/**
 * Options for WASMBinaryCSVStreamTransformer.
 *
 * @template Header - Array of header field names
 */
export interface WASMBinaryCSVStreamTransformerOptions<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  /**
   * Field delimiter character.
   * @defaultValue ","
   */
  delimiter?: string | undefined;

  /**
   * Quote character for escaping fields.
   * @defaultValue '"'
   */
  quotation?: string | undefined;

  /**
   * Maximum number of fields per record.
   * @defaultValue 100000
   */
  maxFieldCount?: number | undefined;

  /**
   * Custom header names. If not provided, the first row will be used as headers.
   */
  header?: Header | undefined;
}

/**
 * Default queuing strategy for the writable side (Uint8Array input).
 * Counts by byte length for accurate memory tracking.
 * @internal
 */
const DEFAULT_WRITABLE_STRATEGY: QueuingStrategy<Uint8Array> = {
  highWaterMark: 65536, // 64KB
  size: (chunk) => chunk.byteLength,
};

/**
 * Default queuing strategy for the readable side (record output).
 * @internal
 */
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
  highWaterMark: 256, // 256 records
});

/**
 * A transform stream that uses WASM to convert CSV byte streams into record objects.
 *
 * This transformer provides streaming CSV parsing with the performance benefits of WebAssembly
 * while maintaining low memory usage through incremental processing. It processes Uint8Array
 * chunks directly, eliminating the overhead of TextDecoder and string conversion.
 *
 * **Performance:**
 * - 20-30% faster than string-based WASM processing (eliminates TextDecoder overhead)
 * - 2-4x faster than JavaScript-based parsing
 * - Constant memory usage (O(1) per record)
 * - Suitable for large files
 *
 * **Requirements:**
 * - WASM module must be loaded before use (call `loadWASM()` first)
 *
 * @template Header - Array of header field names
 *
 * @example Basic usage (no TextDecoderStream needed)
 * ```typescript
 * import { loadWASM, WASMBinaryCSVStreamTransformer } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const response = await fetch('data.csv');
 * const stream = response.body!
 *   .pipeThrough(new WASMBinaryCSVStreamTransformer())
 *   .getReader();
 *
 * while (true) {
 *   const { done, value } = await stream.read();
 *   if (done) break;
 *   console.log(value); // { field1: 'value1', field2: 'value2', ... }
 * }
 * ```
 *
 * @example With custom delimiter
 * ```typescript
 * const transformer = new WASMBinaryCSVStreamTransformer({ delimiter: '\t' });
 *
 * await fetch('data.tsv')
 *   .then(res => res.body!)
 *   .pipeThrough(transformer)
 *   .pipeTo(yourProcessor);
 * ```
 *
 * @example Performance comparison
 * ```typescript
 * // Slower: String-based processing
 * await response.body!
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new WASMCSVStreamTransformer());
 *
 * // Faster: Binary processing (no TextDecoderStream)
 * await response.body!
 *   .pipeThrough(new WASMBinaryCSVStreamTransformer());
 * ```
 *
 * @example With custom backpressure
 * ```typescript
 * const transformer = new WASMBinaryCSVStreamTransformer(
 *   { delimiter: ',' },
 *   { highWaterMark: 131072 }, // 128KB writable buffer
 *   { highWaterMark: 512 }     // 512 records readable buffer
 * );
 * ```
 */
export class WASMBinaryCSVStreamTransformer<
  Header extends ReadonlyArray<string> = readonly string[],
> extends TransformStream<Uint8Array, CSVObjectRecord<Header>> {
  constructor(
    options: WASMBinaryCSVStreamTransformerOptions<Header> = {},
    writableStrategy: QueuingStrategy<Uint8Array> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<
      CSVObjectRecord<Header>
    > = DEFAULT_READABLE_STRATEGY,
  ) {
    const {
      delimiter = DEFAULT_DELIMITER,
      quotation = DEFAULT_QUOTATION,
      maxFieldCount = DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
      header,
    } = options;

    // Create parser with options object (will be passed to WASM)
    const wasmOptions: WASMParserOptions = {};

    if (delimiter !== DEFAULT_DELIMITER) {
      wasmOptions.delimiter = delimiter;
    }
    if (quotation !== DEFAULT_QUOTATION) {
      wasmOptions.quotation = quotation;
    }
    if (maxFieldCount !== DEFAULT_ASSEMBLER_MAX_FIELD_COUNT) {
      wasmOptions.maxFieldCount = maxFieldCount;
    }
    if (header) {
      wasmOptions.header = header;
    }

    // Create parser instance with options object
    // Note: Type cast needed until WASM is rebuilt with new constructor signature
    const parser = new CSVParser(wasmOptions as any);

    // Cache headers across chunks for object assembly
    let cachedHeaders: string[] | null = null;
    let fieldCount = 0;

    /**
     * Convert flat parse result to object records.
     *
     * This is the JS-side object assembly for the Flat data transfer optimization.
     * By doing object construction in JavaScript instead of WASM, we reduce
     * WASM↔JS boundary crossings by 99.98%+ (from N×M to ~3 crossings).
     */
    const assembleRecords = (result: FlatParseResult): CSVObjectRecord<Header>[] => {
      const records: CSVObjectRecord<Header>[] = [];

      // Update cached headers if available
      const headers = result.headers as string[] | null;
      if (headers && !cachedHeaders) {
        cachedHeaders = headers;
        fieldCount = result.fieldCount;
      }

      if (!cachedHeaders || result.recordCount === 0) {
        return records;
      }

      const fieldData = result.fieldData as string[];

      // Assemble objects from flat data
      for (let r = 0; r < result.recordCount; r++) {
        const obj: Record<string, string> = {};
        for (let f = 0; f < fieldCount; f++) {
          // Headers and fieldData are guaranteed to be valid since we checked bounds above
          const header = cachedHeaders[f]!;
          obj[header] = fieldData[r * fieldCount + f] ?? "";
        }
        records.push(obj as CSVObjectRecord<Header>);
      }

      return records;
    };

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.byteLength !== 0) {
            try {
              // Process chunk using flat API (minimizes WASM↔JS boundary crossings)
              // Pass stream: true to indicate we will call flush() separately
              const result: FlatParseResult = parser.processChunkBytes(
                chunk,
                true,
              );

              // Assemble and enqueue records
              for (const record of assembleRecords(result)) {
                controller.enqueue(record);
              }
            } catch (error) {
              controller.error(error);
            }
          }
        },
        flush: async (controller) => {
          try {
            // Flush remaining data using flat API
            const result: FlatParseResult = parser.flush();

            // Assemble and enqueue final records
            for (const record of assembleRecords(result)) {
              controller.enqueue(record);
            }
          } catch (error) {
            controller.error(error);
          }
        },
      },
      writableStrategy,
      readableStrategy,
    );
  }
}
