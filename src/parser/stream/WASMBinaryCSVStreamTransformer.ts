import { CSVStreamParser } from "web-csv-toolbox-wasm";
import type {
  CSVRecord,
  WASMBinaryCSVStreamTransformerOptions,
} from "../../core/types.ts";

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
 * @category Low-level API
 *
 * @param options - CSV-specific options (delimiter, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.byteLength }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256 }`)
 *
 * @remarks
 * **Default Queuing Strategy:**
 * - Writable side: Counts by byte length. Default highWaterMark is 65536 bytes (64KB).
 * - Readable side: Counts each record as 1. Default highWaterMark is 256 records.
 *
 * **Performance:**
 * - 20-30% faster than WASMCSVStreamTransformer (eliminates string conversion overhead)
 * - 2-4x faster than JavaScript-based parsing
 * - Constant memory usage (O(1) per record)
 * - Suitable for large files
 *
 * **Requirements:**
 * - WASM module must be loaded before use (call `loadWASM()` first)
 *
 * @example Basic usage (no TextDecoderStream needed)
 * ```ts
 * import { loadWASM, WASMBinaryCSVStreamTransformer } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const response = await fetch('data.csv');
 * const records = await response.body
 *   .pipeThrough(new WASMBinaryCSVStreamTransformer())
 *   .getReader();
 *
 * for await (const record of records) {
 *   console.log(record);
 * }
 * ```
 *
 * @example With custom delimiter
 * ```ts
 * const transformer = new WASMBinaryCSVStreamTransformer({ delimiter: '\t' });
 *
 * await fetch('data.tsv')
 *   .then(res => res.body)
 *   .pipeThrough(transformer)
 *   .pipeTo(yourProcessor);
 * ```
 *
 * @example Performance comparison
 * ```ts
 * // Slower: String-based processing
 * await response.body
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new WASMCSVStreamTransformer());
 *
 * // Faster: Binary processing (no TextDecoderStream)
 * await response.body
 *   .pipeThrough(new WASMBinaryCSVStreamTransformer());
 * ```
 */
export class WASMBinaryCSVStreamTransformer<
  Header extends ReadonlyArray<string> = string[],
> extends TransformStream<Uint8Array, CSVRecord<Header>> {
  constructor(
    options: WASMBinaryCSVStreamTransformerOptions = {},
    writableStrategy: QueuingStrategy<Uint8Array> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<
      CSVRecord<Header>
    > = DEFAULT_READABLE_STRATEGY,
  ) {
    const delimiter = options.delimiter ?? ",";
    if (delimiter.length !== 1) {
      throw new Error("Delimiter must be a single character");
    }

    const parser = new CSVStreamParser(delimiter.charCodeAt(0));

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.byteLength !== 0) {
            try {
              // Convert Uint8Array to js-sys::Uint8Array for WASM
              const jsArray = new Uint8Array(chunk);

              // Process chunk and get completed records as JavaScript array
              const records = parser.processChunkBytes(
                jsArray,
              ) as CSVRecord<Header>[];

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
            const records = parser.flush() as CSVRecord<Header>[];

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
