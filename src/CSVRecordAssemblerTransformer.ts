import { CSVRecordAssembler } from "./CSVRecordAssembler.ts";
import type {
  CSVRecord,
  CSVRecordAssemblerOptions,
  Token,
} from "./common/types.ts";

/**
 * A transform stream that converts a stream of tokens into a stream of CSV records.
 *
 * @template Header The type of the header row.
 * @param options - CSV-specific options (header, maxFieldCount, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 1024, size: tokens => tokens.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256, size: () => 1 }`)
 *
 * @category Low-level API
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to the standard `TransformStream`.
 *
 * **Default Queuing Strategy:**
 * - Writable side: Counts by number of tokens in each array. Default highWaterMark is 1024 tokens.
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
 * @example Custom queuing strategies
 * ```ts
 * const transformer = new CSVRecordAssemblerTransformer(
 *   {},
 *   { highWaterMark: 2048, size: (tokens) => tokens.length },  // 2048 tokens
 *   { highWaterMark: 512, size: () => 1 },  // 512 records
 * );
 *
 * await tokenStream
 *   .pipeThrough(transformer)
 *   .pipeTo(yourRecordProcessor);
 * ```
 */
export class CSVRecordAssemblerTransformer<
  Header extends ReadonlyArray<string>,
> extends TransformStream<Token[], CSVRecord<Header>> {
  public readonly assembler: CSVRecordAssembler<Header>;

  constructor(
    options: CSVRecordAssemblerOptions<Header> = {},
    writableStrategy: QueuingStrategy<Token[]> = {
      highWaterMark: 1024, // 1024 tokens
      size: (tokens) => tokens.length, // Count by number of tokens in array
    },
    readableStrategy: QueuingStrategy<CSVRecord<Header>> = {
      highWaterMark: 256, // 256 records
      size: () => 1, // Each record counts as 1
    },
  ) {
    const assembler = new CSVRecordAssembler(options);

    super(
      {
        transform: async (tokens, controller) => {
          try {
            let recordCount = 0;
            for (const record of assembler.assemble(tokens, { stream: true })) {
              controller.enqueue(record);
              recordCount++;

              // Check backpressure periodically (every 10 records)
              if (recordCount % 10 === 0 && controller.desiredSize !== null && controller.desiredSize <= 0) {
                // Yield to event loop when backpressure is detected
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }
          } catch (error) {
            controller.error(error);
          }
        },
        flush: async (controller) => {
          try {
            let recordCount = 0;
            for (const record of assembler.assemble()) {
              controller.enqueue(record);
              recordCount++;

              // Check backpressure periodically
              if (recordCount % 10 === 0 && controller.desiredSize !== null && controller.desiredSize <= 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
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
