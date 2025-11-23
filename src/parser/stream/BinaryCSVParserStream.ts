import { DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL } from "@/core/constants.ts";
import type { BinaryCSVParserStreamOptions, CSVRecord } from "@/core/types.ts";

/**
 * Default queuing strategy for the writable side (BufferSource input).
 * Counts by byte length for accurate memory tracking.
 * Uses ByteLengthQueuingStrategy which is compatible at runtime since all BufferSource types have byteLength.
 * @internal
 */
const DEFAULT_WRITABLE_STRATEGY = new ByteLengthQueuingStrategy({
  highWaterMark: 65536, // 64KB worth of bytes
}) as QueuingStrategy<BufferSource>;

/**
 * Default queuing strategy for the readable side (record output).
 * @internal
 */
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
  highWaterMark: 256, // 256 records
});

/**
 * A transform stream that converts a stream of binary data (BufferSource) into a stream of CSV records.
 * Wraps a BinaryCSVParser instance to provide streaming CSV parsing.
 *
 * @template Header - The type of the header row
 * @template Format - Output format: 'object' or 'array'
 *
 * @category Low-level API
 *
 * @param parser - BinaryCSVParser instance to use for parsing
 * @param options - Stream-specific options (backpressureCheckInterval, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `ByteLengthQueuingStrategy({ highWaterMark: 65536 })`)
 * @param readableStrategy - Strategy for the readable side (default: `CountQueuingStrategy({ highWaterMark: 256 })`)
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to CSVLexerTransformer and CSVRecordAssemblerTransformer.
 *
 * Accepts any BufferSource type (Uint8Array, ArrayBuffer, or other TypedArray views) as input chunks.
 *
 * **Default Queuing Strategy:**
 * - Writable side: `ByteLengthQueuingStrategy` with highWaterMark of 65536 bytes (64KB).
 * - Readable side: `CountQueuingStrategy` with highWaterMark of 256 records.
 *
 * **Backpressure Handling:**
 * The transformer monitors `controller.desiredSize` and yields to the event loop when backpressure
 * is detected (desiredSize ≤ 0). This prevents blocking the main thread during heavy processing
 * and allows the downstream consumer to catch up.
 *
 * @example Basic usage
 * ```ts
 * import { FlexibleBinaryObjectCSVParser } from './models/FlexibleBinaryObjectCSVParser.js';
 * import { BinaryCSVParserStream } from './stream/BinaryCSVParserStream.js';
 *
 * const parser = new FlexibleBinaryObjectCSVParser({ header: ['name', 'age'], charset: 'utf-8' });
 * const stream = new BinaryCSVParserStream(parser);
 *
 * const encoder = new TextEncoder();
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(encoder.encode("Alice,30\r\n"));
 *     controller.enqueue(encoder.encode("Bob,25\r\n"));
 *     controller.close();
 *   }
 * })
 *   .pipeThrough(stream)
 *   .pipeTo(new WritableStream({
 *     write(record) {
 *       console.log(record);
 *     }
 *   }));
 * // { name: 'Alice', age: '30' }
 * // { name: 'Bob', age: '25' }
 * ```
 *
 * @example With fetch API
 * ```ts
 * const parser = new FlexibleBinaryObjectCSVParser({ header: ['name', 'age'] });
 * const stream = new BinaryCSVParserStream(parser);
 *
 * await fetch('large-file.csv')
 *   .then(res => res.body)
 *   .pipeThrough(stream)
 *   .pipeTo(yourProcessor);
 * ```
 */
export class BinaryCSVParserStream<
  Header extends ReadonlyArray<string> = readonly string[],
  Format extends "object" | "array" = "object",
> extends TransformStream<BufferSource, CSVRecord<Header, Format>> {
  public readonly parser: {
    parse(
      chunk?: BufferSource,
      options?: { stream?: boolean },
    ): IterableIterator<CSVRecord<Header, Format>>;
  };

  /**
   * Yields to the event loop to allow backpressure handling.
   * Can be overridden for testing purposes.
   * @internal
   */
  protected async yieldToEventLoop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  constructor(
    parser: {
      parse(
        chunk?: BufferSource,
        options?: { stream?: boolean },
      ): IterableIterator<CSVRecord<Header, Format>>;
    },
    options: BinaryCSVParserStreamOptions = {},
    writableStrategy: QueuingStrategy<BufferSource> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<
      CSVRecord<Header, Format>
    > = DEFAULT_READABLE_STRATEGY,
  ) {
    const checkInterval =
      options.backpressureCheckInterval ??
      DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL;

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.byteLength !== 0) {
            try {
              const records = parser.parse(chunk, { stream: true });
              let recordCount = 0;

              for (const record of records) {
                controller.enqueue(record as CSVRecord<Header, Format>);
                recordCount++;

                // Check backpressure periodically based on checkInterval
                if (
                  recordCount % checkInterval === 0 &&
                  controller.desiredSize !== null &&
                  controller.desiredSize <= 0
                ) {
                  // Yield to event loop when backpressure is detected
                  await this.yieldToEventLoop();
                }
              }
            } catch (error) {
              controller.error(error);
            }
          }
        },
        flush: async (controller) => {
          try {
            const records = parser.parse(); // Flush without chunk
            let recordCount = 0;

            for (const record of records) {
              controller.enqueue(record as CSVRecord<Header, Format>);
              recordCount++;

              // Check backpressure periodically based on checkInterval
              if (
                recordCount % checkInterval === 0 &&
                controller.desiredSize !== null &&
                controller.desiredSize <= 0
              ) {
                await this.yieldToEventLoop();
              }
            }
          } catch (error) {
            controller.error(error);
          }
        },
      },
      writableStrategy,
      readableStrategy,
    );
    this.parser = parser;
  }
}
