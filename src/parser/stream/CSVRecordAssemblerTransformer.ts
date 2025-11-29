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
 * For most use cases, prefer the factory function {@link createCSVRecordAssemblerTransformer}.
 * Use this class directly only when you need a custom assembler implementation.
 *
 * @category Low-level API
 *
 * @template Header The type of the header row.
 * @template Format The output format ('object' or 'array').
 * @param assembler - A CSVRecordAssembler instance (required). Use {@link createCSVRecordAssembler} to create one.
 * @param options - Stream-specific options (backpressureCheckInterval, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 1024, size: () => 1 }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 256, size: () => 1 }`)
 *
 * @see {@link https://github.com/kamiazya/web-csv-toolbox/blob/main/docs/how-to-guides/choosing-the-right-api.md | Choosing the Right API} for guidance on selecting the appropriate API level.
 *
 * @example Custom assembler implementation
 * ```ts
 * import { CSVRecordAssemblerTransformer, type CSVRecordAssembler } from 'web-csv-toolbox';
 *
 * // Custom assembler for specialized record formats
 * class MyCustomAssembler implements CSVRecordAssembler {
 *   *assemble(tokens: Iterable<Token>, options?: { stream?: boolean }) {
 *     // Custom assembly logic
 *   }
 * }
 *
 * const customAssembler = new MyCustomAssembler();
 * tokenStream.pipeThrough(new CSVRecordAssemblerTransformer(customAssembler));
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
