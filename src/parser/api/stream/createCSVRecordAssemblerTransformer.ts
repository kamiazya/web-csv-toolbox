import type {
  CSVRecord,
  CSVRecordAssemblerCommonOptions,
  CSVRecordAssemblerTransformerStreamOptions,
  Token,
} from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";

type InferFormat<Options> = Options extends { outputFormat: "array" }
  ? "array"
  : "object";

/**
 * Factory function to create a CSVRecordAssemblerTransformer instance.
 *
 * This function internally creates a CSVRecordAssembler and wraps it in a
 * CSVRecordAssemblerTransformer, providing a simpler API for stream-based
 * CSV record assembly.
 *
 * @category Low-level API
 *
 * @template Header - The type of the header row
 * @template Options - The assembler options type
 * @param options - CSV assembler options including header, outputFormat, etc.
 * @param streamOptions - Stream-specific options like backpressureCheckInterval
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 1024, size: () => 1 }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256, size: () => 1 }`)
 * @returns A CSVRecordAssemblerTransformer instance configured with the specified options
 *
 * @remarks
 * This factory function simplifies the creation of CSVRecordAssemblerTransformer
 * by handling the assembler instantiation internally. Use this when you don't
 * need direct access to the assembler instance.
 *
 * For advanced use cases where you need to reuse an assembler or access it
 * directly, use {@link createCSVRecordAssembler} and
 * {@link CSVRecordAssemblerTransformer} separately.
 *
 * @example Basic usage with header from data
 * ```ts
 * import { createCSVLexerTransformer, createCSVRecordAssemblerTransformer } from 'web-csv-toolbox';
 *
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("name,age\r\n");
 *     controller.enqueue("Alice,20\r\n");
 *     controller.enqueue("Bob,25\r\n");
 *     controller.close();
 *   }
 * })
 *   .pipeThrough(createCSVLexerTransformer())
 *   .pipeThrough(createCSVRecordAssemblerTransformer())
 *   .pipeTo(new WritableStream({ write(record) {
 *     console.log(record);
 *   }}));
 * // { name: "Alice", age: "20" }
 * // { name: "Bob", age: "25" }
 * ```
 *
 * @example With predefined header
 * ```ts
 * import { createCSVLexerTransformer, createCSVRecordAssemblerTransformer } from 'web-csv-toolbox';
 *
 * const transformer = createCSVRecordAssemblerTransformer({
 *   header: ['name', 'age'] as const
 * });
 *
 * // Data without header row
 * csvStream
 *   .pipeThrough(createCSVLexerTransformer())
 *   .pipeThrough(transformer);
 * ```
 *
 * @example Array output format
 * ```ts
 * import { createCSVLexerTransformer, createCSVRecordAssemblerTransformer } from 'web-csv-toolbox';
 *
 * const transformer = createCSVRecordAssemblerTransformer({
 *   outputFormat: 'array'
 * });
 *
 * csvStream
 *   .pipeThrough(createCSVLexerTransformer())
 *   .pipeThrough(transformer)
 *   .pipeTo(new WritableStream({ write(record) {
 *     console.log(record); // ['Alice', '20']
 *   }}));
 * ```
 *
 * @example With backpressure tuning
 * ```ts
 * import { createCSVLexerTransformer, createCSVRecordAssemblerTransformer } from 'web-csv-toolbox';
 *
 * const transformer = createCSVRecordAssemblerTransformer(
 *   { header: ['name', 'age'] as const },
 *   { backpressureCheckInterval: 20 },
 *   new CountQueuingStrategy({ highWaterMark: 2048 }),
 *   new CountQueuingStrategy({ highWaterMark: 512 })
 * );
 *
 * await tokenStream
 *   .pipeThrough(transformer)
 *   .pipeTo(yourRecordProcessor);
 * ```
 */
export function createCSVRecordAssemblerTransformer<
  Header extends ReadonlyArray<string> = readonly string[],
  Options extends
    CSVRecordAssemblerCommonOptions<Header> = CSVRecordAssemblerCommonOptions<Header>,
>(
  options?: Options,
  streamOptions?: CSVRecordAssemblerTransformerStreamOptions,
  writableStrategy?: QueuingStrategy<Token>,
  readableStrategy?: QueuingStrategy<CSVRecord<Header, InferFormat<Options>>>,
): CSVRecordAssemblerTransformer<Header, InferFormat<Options>> {
  const assembler = createCSVRecordAssembler<Header, Options>(options);
  return new CSVRecordAssemblerTransformer<Header, InferFormat<Options>>(
    assembler as any,
    streamOptions ?? {},
    writableStrategy,
    readableStrategy,
  );
}
