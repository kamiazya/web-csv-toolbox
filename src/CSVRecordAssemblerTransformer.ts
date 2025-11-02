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
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 16 }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 8 }`)
 *
 * @category Low-level API
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to the standard `TransformStream`.
 *
 * Default highWaterMark values are starting points based on data flow characteristics,
 * not empirical benchmarks. Optimal values depend on your runtime environment,
 * data size, and performance requirements.
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
 *   { highWaterMark: 8 },  // writable
 *   { highWaterMark: 2 },  // readable
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
    writableStrategy: QueuingStrategy<Token[]> = { highWaterMark: 16 },
    readableStrategy: QueuingStrategy<CSVRecord<Header>> = { highWaterMark: 8 },
  ) {
    const assembler = new CSVRecordAssembler(options);

    super(
      {
        transform: (tokens, controller) => {
          try {
            for (const token of assembler.assemble(tokens, { stream: true })) {
              controller.enqueue(token);
            }
          } catch (error) {
            controller.error(error);
          }
        },
        flush: (controller) => {
          try {
            for (const token of assembler.assemble()) {
              controller.enqueue(token);
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
