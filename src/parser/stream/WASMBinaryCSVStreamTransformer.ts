import { CSVParser } from "web-csv-toolbox-wasm";
import type { CSVObjectRecord } from "@/core/types.ts";

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
  delimiter?: string;

  /**
   * Quote character for escaping fields.
   * @defaultValue '"'
   */
  quotation?: string;

  /**
   * Maximum number of fields per record.
   * @defaultValue 100000
   */
  maxFieldCount?: number;

  /**
   * Custom header names. If not provided, the first row will be used as headers.
   */
  header?: Header;
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
      delimiter = ",",
      quotation = '"',
      maxFieldCount = 100000,
      header,
    } = options;

    // Create parser with options object (will be passed to WASM)
    const wasmOptions: {
      delimiter?: string;
      quote?: string;
      maxFieldCount?: number;
      header?: readonly string[];
    } = {};

    if (delimiter !== ",") {
      wasmOptions.delimiter = delimiter;
    }
    if (quotation !== '"') {
      wasmOptions.quote = quotation;
    }
    if (maxFieldCount !== 100000) {
      wasmOptions.maxFieldCount = maxFieldCount;
    }
    if (header) {
      wasmOptions.header = header;
    }

    // Create parser instance with options object
    // Note: Type cast needed until WASM is rebuilt with new constructor signature
    const parser = new CSVParser(wasmOptions as any);

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.byteLength !== 0) {
            try {
              // Process chunk and get completed records as JavaScript array
              const records = parser.processChunkBytes(
                chunk,
              ) as CSVObjectRecord<Header>[];

              // Enqueue each completed record
              for (const record of records) {
                controller.enqueue(record);
              }
            } catch (error) {
              controller.error(error);
            }
          }
        },
        flush: async (controller) => {
          try {
            // Flush remaining data and get final records as JavaScript array
            const records = parser.flush() as CSVObjectRecord<Header>[];

            // Enqueue final records
            for (const record of records) {
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
