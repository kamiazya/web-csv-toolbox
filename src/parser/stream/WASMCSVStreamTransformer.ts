import { CSVStreamParser } from "web-csv-toolbox-wasm";
import type {
  CSVRecord,
  WASMCSVStreamTransformerOptions,
} from "../../core/types.ts";

/**
 * Default queuing strategy for the writable side (string input).
 * Counts by character length for accurate memory tracking.
 * @internal
 */
const DEFAULT_WRITABLE_STRATEGY: QueuingStrategy<string> = {
  highWaterMark: 65536, // 64KB worth of characters
  size: (chunk) => chunk.length,
};

/**
 * Default queuing strategy for the readable side (record output).
 * @internal
 */
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
  highWaterMark: 256, // 256 records
});

/**
 * A transform stream that uses WASM to convert CSV strings into record objects.
 *
 * This transformer provides streaming CSV parsing with the performance benefits of WebAssembly
 * while maintaining low memory usage through incremental processing.
 *
 * @category Low-level API
 *
 * @param options - CSV-specific options (delimiter, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256 }`)
 *
 * @remarks
 * **Default Queuing Strategy:**
 * - Writable side: Counts by string length (characters). Default highWaterMark is 65536 characters (≈64KB).
 * - Readable side: Counts each record as 1. Default highWaterMark is 256 records.
 *
 * **Performance:**
 * - 2-3x faster than JavaScript-based parsing
 * - Constant memory usage (O(1) per record)
 * - Suitable for large files
 *
 * **Requirements:**
 * - WASM module must be loaded before use (call `loadWASM()` first)
 *
 * @example Basic usage
 * ```ts
 * import { loadWASM, WASMCSVStreamTransformer } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const response = await fetch('data.csv');
 * const records = await response.body
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new WASMCSVStreamTransformer())
 *   .getReader();
 *
 * for await (const record of records) {
 *   console.log(record);
 * }
 * ```
 *
 * @example With custom delimiter
 * ```ts
 * const transformer = new WASMCSVStreamTransformer({ delimiter: '\t' });
 *
 * await fetch('data.tsv')
 *   .then(res => res.body)
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(transformer)
 *   .pipeTo(yourProcessor);
 * ```
 */
export class WASMCSVStreamTransformer<
  Header extends ReadonlyArray<string> = string[],
> extends TransformStream<string, CSVRecord<Header>> {
  constructor(
    options: WASMCSVStreamTransformerOptions = {},
    writableStrategy: QueuingStrategy<string> = DEFAULT_WRITABLE_STRATEGY,
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
          if (chunk.length !== 0) {
            try {
              // Process chunk and get completed records as JavaScript array
              const records = parser.processChunk(chunk) as CSVRecord<Header>[];

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
