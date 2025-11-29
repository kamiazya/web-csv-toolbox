import {
  type DEFAULT_DELIMITER,
  type DEFAULT_QUOTATION,
  DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL,
} from "@/core/constants.ts";
import type {
  StringCSVLexer,
  StringCSVLexerTransformerStreamOptions,
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
 * For most use cases, prefer the factory function {@link createStringCSVLexerTransformer}.
 * Use this class directly only when you need a custom lexer implementation.
 *
 * @category Low-level API
 *
 * @param lexer - A StringCSVLexer instance (required). Use {@link createStringCSVLexer} to create one.
 * @param options - Stream-specific options (backpressureCheckInterval, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 1024, size: () => 1 }`)
 *
 * @see {@link https://github.com/kamiazya/web-csv-toolbox/blob/main/docs/how-to-guides/choosing-the-right-api.md | Choosing the Right API} for guidance on selecting the appropriate API level.
 *
 * @example Custom lexer implementation
 * ```ts
 * import { StringCSVLexerTransformer, type StringCSVLexer, type Token } from 'web-csv-toolbox';
 *
 * // Custom lexer for non-standard CSV dialect
 * class MyCustomLexer implements StringCSVLexer {
 *   lex(chunk?: string, options?: { stream?: boolean }): IterableIterator<Token> {
 *     // Return an iterator (can use internal generator)
 *     return this.#tokens();
 *   }
 *   *#tokens(): Generator<Token> {
 *     // Actual token generation logic
 *   }
 * }
 *
 * const customLexer = new MyCustomLexer();
 * stream.pipeThrough(new StringCSVLexerTransformer(customLexer));
 * ```
 */
export class StringCSVLexerTransformer<
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
    options: StringCSVLexerTransformerStreamOptions = {},
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
