import type {
  CSVRecord,
  WASMStringCSVStreamTransformerOptions,
} from "../../core/types.ts";
import { WASMStringCSVParser } from "../models/WASMStringCSVParser.ts";

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
 * import { loadWASM, WASMStringCSVStreamTransformer } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const response = await fetch('data.csv');
 * const records = await response.body
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new WASMStringCSVStreamTransformer())
 *   .getReader();
 *
 * for await (const record of records) {
 *   console.log(record);
 * }
 * ```
 *
 * @example With custom delimiter
 * ```ts
 * const transformer = new WASMStringCSVStreamTransformer({ delimiter: '\t' });
 *
 * await fetch('data.tsv')
 *   .then(res => res.body)
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(transformer)
 *   .pipeTo(yourProcessor);
 * ```
 */
export class WASMStringCSVStreamTransformer<
  Header extends ReadonlyArray<string> = string[],
> extends TransformStream<string, CSVRecord<Header>> {
  constructor(
    options: WASMStringCSVStreamTransformerOptions = {},
    writableStrategy: QueuingStrategy<string> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<
      CSVRecord<Header>
    > = DEFAULT_READABLE_STRATEGY,
  ) {
    const parser = new WASMStringCSVParser<Header>(options);

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.length !== 0) {
            try {
              // Process chunk in streaming mode and get completed records
              const records = parser.parse(chunk, { stream: true });

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
            // Flush remaining data and get final records
            const records = parser.parse();

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
