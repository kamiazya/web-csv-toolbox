import { DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL } from "@/core/constants.ts";
import type { CSVRecord, StringCSVParserStreamOptions } from "@/core/types.ts";

/**
 * Default queuing strategy for the writable side (string input).
 * Counts by character length for accurate memory tracking.
 * @internal
 */
const DEFAULT_WRITABLE_STRATEGY: QueuingStrategy<string> = {
  highWaterMark: 65536, // 64KB worth of characters
  size: (chunk) => chunk.length, // Count by string length
};

/**
 * Default queuing strategy for the readable side (record output).
 * @internal
 */
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
  highWaterMark: 256, // 256 records
});

/**
 * A transform stream that converts a stream of strings into a stream of CSV records.
 * Wraps a StringCSVParser instance to provide streaming CSV parsing.
 *
 * @template Header - The type of the header row
 * @template Format - Output format: 'object' or 'array'
 *
 * @category Low-level API
 *
 * @param parser - StringCSVParser instance to use for parsing
 * @param options - Stream-specific options (backpressureCheckInterval, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256 }`)
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to CSVLexerTransformer and CSVRecordAssemblerTransformer.
 *
 * **Default Queuing Strategy:**
 * - Writable side: Counts by string length (characters). Default highWaterMark is 65536 characters (≈64KB).
 * - Readable side: Counts each record as 1. Default highWaterMark is 256 records.
 *
 * **Backpressure Handling:**
 * The transformer monitors `controller.desiredSize` and yields to the event loop when backpressure
 * is detected (desiredSize ≤ 0). This prevents blocking the main thread during heavy processing
 * and allows the downstream consumer to catch up.
 *
 * @example Basic usage
 * ```ts
 * import { FlexibleStringObjectCSVParser } from './models/FlexibleStringObjectCSVParser.js';
 * import { StringCSVParserStream } from './stream/StringCSVParserStream.js';
 *
 * const parser = new FlexibleStringObjectCSVParser({ header: ['name', 'age'] });
 * const stream = new StringCSVParserStream(parser);
 *
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("Alice,30\r\n");
 *     controller.enqueue("Bob,25\r\n");
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
 * @example With custom queuing strategies
 * ```ts
 * const parser = new FlexibleStringObjectCSVParser({ header: ['name', 'age'] });
 * const stream = new StringCSVParserStream(
 *   parser,
 *   { backpressureCheckInterval: 50 },
 *   { highWaterMark: 131072, size: (chunk) => chunk.length },
 *   new CountQueuingStrategy({ highWaterMark: 512 })
 * );
 *
 * await fetch('large-file.csv')
 *   .then(res => res.body)
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(stream)
 *   .pipeTo(yourProcessor);
 * ```
 */
export class StringCSVParserStream<
  Header extends ReadonlyArray<string> = readonly string[],
  Format extends "object" | "array" = "object",
> extends TransformStream<string, CSVRecord<Header, Format>> {
  public readonly parser: {
    parse(
      chunk?: string,
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
        chunk?: string,
        options?: { stream?: boolean },
      ): IterableIterator<CSVRecord<Header, Format>>;
    },
    options: StringCSVParserStreamOptions = {},
    writableStrategy: QueuingStrategy<string> = DEFAULT_WRITABLE_STRATEGY,
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
          if (chunk.length !== 0) {
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
