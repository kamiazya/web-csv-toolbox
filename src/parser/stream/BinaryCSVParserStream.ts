import type {
  BinaryCSVParserStreamOptions,
  CSVRecord,
} from "@/core/types.ts";

/**
 * Default queuing strategy for the writable side (BufferSource input).
 * Counts by byte length for accurate memory tracking.
 * @internal
 */
const DEFAULT_WRITABLE_STRATEGY: QueuingStrategy<BufferSource> = {
  highWaterMark: 65536, // 64KB worth of bytes
  size: (chunk) => chunk.byteLength, // Count by byte length
};

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
 *
 * @category Low-level API
 *
 * @param parser - BinaryCSVParser instance to use for parsing
 * @param options - Stream-specific options (backpressureCheckInterval, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.byteLength }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256 }`)
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to CSVLexerTransformer and CSVRecordAssemblerTransformer.
 *
 * Accepts any BufferSource type (Uint8Array, ArrayBuffer, or other TypedArray views) as input chunks.
 *
 * **Default Queuing Strategy:**
 * - Writable side: Counts by byte length. Default highWaterMark is 65536 bytes (64KB).
 * - Readable side: Counts each record as 1. Default highWaterMark is 256 records.
 *
 * **Backpressure Handling:**
 * The transformer monitors `controller.desiredSize` and yields to the event loop when backpressure
 * is detected (desiredSize ≤ 0). This prevents blocking the main thread during heavy processing
 * and allows the downstream consumer to catch up.
 *
 * @example Basic usage
 * ```ts
 * import { FlexibleBinaryCSVParser } from './models/FlexibleBinaryCSVParser.js';
 * import { BinaryCSVParserStream } from './stream/BinaryCSVParserStream.js';
 *
 * const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'], charset: 'utf-8' });
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
 * const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
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
> extends TransformStream<BufferSource, CSVRecord<Header>> {
  public readonly parser: {
    parse(
      chunk?: BufferSource,
      options?: { stream?: boolean },
    ): CSVRecord<Header>[];
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
      ): CSVRecord<Header>[];
    },
    options: BinaryCSVParserStreamOptions = {},
    writableStrategy: QueuingStrategy<BufferSource> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<
      CSVRecord<Header>
    > = DEFAULT_READABLE_STRATEGY,
  ) {
    const checkInterval = options.backpressureCheckInterval ?? 100;

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.byteLength !== 0) {
            try {
              const records = parser.parse(chunk, { stream: true });
              let recordCount = 0;

              for (const record of records) {
                controller.enqueue(record as CSVRecord<Header>);
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
              controller.enqueue(record as CSVRecord<Header>);
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
