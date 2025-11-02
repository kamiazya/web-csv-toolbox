import { CSVRecordAssembler } from "./CSVRecordAssembler.ts";
import type {
  CSVRecord,
  CSVRecordAssemblerOptions,
  Token,
} from "./common/types.ts";

/**
 * A transform stream that converts a stream of tokens into a stream of CSV records.
 * @template Header The type of the header row.
 * @param options The options for the parser.
 *
 * @category Low-level API
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
 * @example Custom queuing strategies for memory-constrained environments
 * ```ts
 * const transformer = new CSVRecordAssemblerTransformer({
 *   writableStrategy: { highWaterMark: 8 },
 *   readableStrategy: { highWaterMark: 2 },
 * });
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

  constructor(options: CSVRecordAssemblerOptions<Header> = {}) {
    const assembler = new CSVRecordAssembler(options);
    const {
      writableStrategy = { highWaterMark: 16 },
      readableStrategy = { highWaterMark: 8 },
    } = options;

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
