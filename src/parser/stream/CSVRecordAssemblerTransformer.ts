import { DEFAULT_ASSEMBLER_BACKPRESSURE_CHECK_INTERVAL } from "@/core/constants.ts";
import type {
  CSVRecord,
  CSVRecordAssembler,
  CSVRecordAssemblerTransformerStreamOptions,
  Token,
} from "@/core/types.ts";
import type { FlexibleCSVArrayRecordAssembler } from "@/parser/models/FlexibleCSVArrayRecordAssembler.ts";
import type { FlexibleCSVObjectRecordAssembler } from "@/parser/models/FlexibleCSVObjectRecordAssembler.ts";

/**
 * Default queuing strategy for the writable side (token input).
 * @internal
 */
const DEFAULT_WRITABLE_STRATEGY = new CountQueuingStrategy({
  highWaterMark: 1024, // 1024 tokens
});

/**
 * Default queuing strategy for the readable side (record output).
 * @internal
 */
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
  highWaterMark: 256, // 256 records
});

/**
 * A transform stream that converts a stream of tokens into a stream of CSV records.
 *
 * @template Header The type of the header row.
 * @template Format The output format ('object' or 'array').
 * @param options - CSV-specific options (header, maxFieldCount, checkInterval, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 1024, size: () => 1 }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256, size: () => 1 }`)
 *
 * @category Low-level API
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to the standard `TransformStream`.
 *
 * **Default Queuing Strategy:**
 * - Writable side: Counts each token as 1. Default highWaterMark is 1024 tokens.
 * - Readable side: Counts each record as 1. Default highWaterMark is 256 records.
 *
 * **Backpressure Handling:**
 * The transformer monitors `controller.desiredSize` and yields to the event loop when backpressure
 * is detected (desiredSize ≤ 0). This prevents blocking the main thread during heavy processing
 * and allows the downstream consumer to catch up.
 *
 * These defaults are starting points based on data flow characteristics, not empirical benchmarks.
 * Optimal values depend on your runtime environment, data size, and performance requirements.
 *
 * @example Parse a CSV with headers by data
 *  ```ts
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("name,age\r\n");
 *     controller.enqueue("Alice,20\r\n");
 *     controller.enqueue("Bob,25\r\n");
 *     controller.enqueue("Charlie,30\r\n");
 *     controller.close();
 *   })
 *   .pipeThrough(new CSVLexerTransformer())
 *   .pipeThrough(new CSVRecordAssemblerTransformer())
 *   .pipeTo(new WritableStream({ write(row) { console.log(row); }}));
 * // { name: "Alice", age: "20" }
 * // { name: "Bob", age: "25" }
 * // { name: "Charlie", age: "30" }
 * ```
 *
 * @example Parse a CSV with headers by options
 * ```ts
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("Alice,20\r\n");
 *     controller.enqueue("Bob,25\r\n");
 *     controller.enqueue("Charlie,30\r\n");
 *     controller.close();
 *   }
 * })
 * .pipeThrough(new CSVLexerTransformer())
 * .pipeThrough(new CSVRecordAssemblerTransformer({ header: ["name", "age"] }))
 * .pipeTo(new WritableStream({ write(row) { console.log(row); }}));
 * // { name: "Alice", age: "20" }
 * // { name: "Bob", age: "25" }
 * // { name: "Charlie", age: "30" }
 * ```
 *
 * @example Custom queuing strategies with backpressure tuning
 * ```ts
 * const transformer = new CSVRecordAssemblerTransformer(
 *   {
 *     backpressureCheckInterval: 20  // Check backpressure every 20 records
 *   },
 *   new CountQueuingStrategy({ highWaterMark: 2048 }),  // 2048 tokens
 *   new CountQueuingStrategy({ highWaterMark: 512 })    // 512 records
 * );
 *
 * await tokenStream
 *   .pipeThrough(transformer)
 *   .pipeTo(yourRecordProcessor);
 * ```
 */
export class CSVRecordAssemblerTransformer<
  Header extends ReadonlyArray<string>,
  Format extends "object" | "array" = "object",
> extends TransformStream<Token, CSVRecord<Header, Format>> {
  public readonly assembler:
    | CSVRecordAssembler<Header, Format>
    | FlexibleCSVObjectRecordAssembler<Header>
    | FlexibleCSVArrayRecordAssembler<Header>;

  /**
   * Yields to the event loop to allow backpressure handling.
   * Can be overridden for testing purposes.
   * @internal
   */
  protected async yieldToEventLoop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  constructor(
    assembler:
      | CSVRecordAssembler<Header, Format>
      | FlexibleCSVObjectRecordAssembler<Header>
      | FlexibleCSVArrayRecordAssembler<Header>,
    options: CSVRecordAssemblerTransformerStreamOptions = {},
    writableStrategy: QueuingStrategy<Token> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<
      CSVRecord<Header, Format>
    > = DEFAULT_READABLE_STRATEGY,
  ) {
    const checkInterval =
      options.backpressureCheckInterval ??
      DEFAULT_ASSEMBLER_BACKPRESSURE_CHECK_INTERVAL;

    super(
      {
        transform: async (token, controller) => {
          try {
            let recordCount = 0;
            // Pass single token directly to assemble (no array creation)
            for (const record of assembler.assemble(token, { stream: true })) {
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
        },
        flush: async (controller) => {
          try {
            let recordCount = 0;
            // Call assemble without arguments to flush
            for (const record of assembler.assemble()) {
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
    this.assembler = assembler;
  }
}
