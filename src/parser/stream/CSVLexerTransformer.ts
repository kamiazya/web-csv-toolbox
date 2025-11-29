import {
  type DEFAULT_DELIMITER,
  type DEFAULT_QUOTATION,
  DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL,
} from "@/core/constants.ts";
import type {
  CSVLexerTransformerStreamOptions,
  StringCSVLexer,
  Token,
} from "@/core/types.ts";

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
 * Default queuing strategy for the readable side (token output).
 * @internal
 */
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
  highWaterMark: 1024, // 1024 tokens
});

/**
 * A transform stream that converts a stream of strings into a stream of tokens.
 *
 * @category Low-level API
 *
 * @param lexer - A StringCSVLexer instance (required). Use {@link createStringCSVLexer} to create one.
 * @param options - Stream-specific options (backpressureCheckInterval, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 1024, size: () => 1 }`)
 *
 * @remarks
 * **Recommended: Use the factory function**
 *
 * For simpler usage, use {@link createCSVLexerTransformer} which handles lexer creation internally:
 * ```ts
 * import { createCSVLexerTransformer } from 'web-csv-toolbox';
 * stream.pipeThrough(createCSVLexerTransformer({ delimiter: ',' }));
 * ```
 *
 * **Direct instantiation (advanced)**
 *
 * If you need direct access to the lexer or want to reuse it, use the constructor directly:
 * ```ts
 * import { createStringCSVLexer, CSVLexerTransformer } from 'web-csv-toolbox';
 * const lexer = createStringCSVLexer({ delimiter: ',' });
 * stream.pipeThrough(new CSVLexerTransformer(lexer));
 * ```
 *
 * **Queuing Strategy:**
 * - Writable side: Counts by string length (characters). Default highWaterMark is 65536 characters (≈64KB).
 * - Readable side: Counts each token as 1. Default highWaterMark is 1024 tokens.
 *
 * **Backpressure Handling:**
 * The transformer monitors `controller.desiredSize` and yields to the event loop when backpressure
 * is detected (desiredSize ≤ 0). This prevents blocking the main thread during heavy processing
 * and allows the downstream consumer to catch up.
 *
 * @example Recommended: Using factory function
 * ```ts
 * import { createCSVLexerTransformer } from 'web-csv-toolbox';
 *
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("name,age\r\n");
 *     controller.enqueue("Alice,20\r\n");
 *     controller.close();
 *   }
 * })
 *   .pipeThrough(createCSVLexerTransformer())
 *   .pipeTo(new WritableStream({ write(token) {
 *     console.log(token);
 *   }}));
 * // { type: Field, value: "name", location: {...} }
 * // { type: FieldDelimiter, value: ",", location: {...} }
 * // ...
 * ```
 *
 * @example Direct instantiation with lexer
 * ```ts
 * import { createStringCSVLexer, CSVLexerTransformer } from 'web-csv-toolbox';
 *
 * const lexer = createStringCSVLexer({ delimiter: ',' });
 * const transformer = new CSVLexerTransformer(lexer);
 *
 * stream.pipeThrough(transformer);
 * ```
 *
 * @example Custom queuing strategies with backpressure tuning
 * ```ts
 * import { createStringCSVLexer, CSVLexerTransformer } from 'web-csv-toolbox';
 *
 * const lexer = createStringCSVLexer({ delimiter: ',' });
 * const transformer = new CSVLexerTransformer(
 *   lexer,
 *   { backpressureCheckInterval: 50 },
 *   { highWaterMark: 131072, size: (chunk) => chunk.length },
 *   new CountQueuingStrategy({ highWaterMark: 2048 })
 * );
 *
 * await fetch('large-file.csv')
 *   .then(res => res.body)
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(transformer)
 *   .pipeTo(yourProcessor);
 * ```
 */
export class CSVLexerTransformer<
  _Delimiter extends string = DEFAULT_DELIMITER,
  _Quotation extends string = DEFAULT_QUOTATION,
> extends TransformStream<string, Token> {
  public readonly lexer: StringCSVLexer;

  /**
   * Yields to the event loop to allow backpressure handling.
   * Can be overridden for testing purposes.
   * @internal
   */
  protected async yieldToEventLoop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  constructor(
    lexer: StringCSVLexer,
    options: CSVLexerTransformerStreamOptions = {},
    writableStrategy: QueuingStrategy<string> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<Token> = DEFAULT_READABLE_STRATEGY,
  ) {
    const checkInterval =
      options.backpressureCheckInterval ??
      DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL;

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.length !== 0) {
            try {
              let tokenCount = 0;
              for (const token of lexer.lex(chunk, { stream: true })) {
                controller.enqueue(token);
                tokenCount++;

                // Check backpressure periodically based on checkInterval
                if (
                  tokenCount % checkInterval === 0 &&
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
            let tokenCount = 0;
            for (const token of lexer.lex()) {
              controller.enqueue(token);
              tokenCount++;

              // Check backpressure periodically based on checkInterval
              if (
                tokenCount % checkInterval === 0 &&
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
    this.lexer = lexer;
  }
}
