/**
 * Binary CSV Lexer Transformer
 *
 * A TransformStream that converts a stream of binary CSV data (Uint8Array)
 * into a stream of tokens using AsyncBinaryCSVLexer.
 *
 * @example
 * ```ts
 * const backend = new CSVSeparatorIndexingBackend();
 * await backend.initialize();
 *
 * const lexer = new GPUBinaryCSVLexer({ backend });
 * const transformer = new BinaryCSVLexerTransformer(lexer);
 *
 * await fetch('data.csv')
 *   .then(res => res.body)
 *   .pipeThrough(transformer)
 *   .pipeTo(new WritableStream({
 *     write(token) { console.log(token); }
 *   }));
 *
 * await backend.destroy();
 * ```
 */

import { DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL } from "@/core/constants.ts";
import type { AsyncBinaryCSVLexer, Token } from "@/core/types.ts";

/**
 * Options for BinaryCSVLexerTransformer
 */
export interface BinaryCSVLexerTransformerOptions {
  /**
   * Interval for checking backpressure (in number of tokens).
   * @default 100
   */
  backpressureCheckInterval?: number;
}

/**
 * Default queuing strategy for the writable side (binary input).
 * Counts by byte length for accurate memory tracking.
 * @internal
 */
const DEFAULT_WRITABLE_STRATEGY: QueuingStrategy<Uint8Array> = {
  highWaterMark: 65536, // 64KB worth of bytes
  size: (chunk) => chunk.byteLength,
};

/**
 * Default queuing strategy for the readable side (token output).
 * @internal
 */
const DEFAULT_READABLE_STRATEGY = new CountQueuingStrategy({
  highWaterMark: 1024, // 1024 tokens
});

/**
 * A transform stream that converts binary CSV data into tokens.
 *
 * Similar to CSVLexerTransformer but works with Uint8Array input
 * and uses AsyncBinaryCSVLexer for GPU-accelerated processing.
 */
export class BinaryCSVLexerTransformer extends TransformStream<
  Uint8Array,
  Token
> {
  public readonly lexer: AsyncBinaryCSVLexer;

  /**
   * Yields to the event loop to allow backpressure handling.
   * Can be overridden for testing purposes.
   * @internal
   */
  protected async yieldToEventLoop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  constructor(
    lexer: AsyncBinaryCSVLexer,
    options: BinaryCSVLexerTransformerOptions = {},
    writableStrategy: QueuingStrategy<Uint8Array> = DEFAULT_WRITABLE_STRATEGY,
    readableStrategy: QueuingStrategy<Token> = DEFAULT_READABLE_STRATEGY,
  ) {
    const checkInterval =
      options.backpressureCheckInterval ??
      DEFAULT_STREAM_BACKPRESSURE_CHECK_INTERVAL;

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.byteLength !== 0) {
            try {
              let tokenCount = 0;
              for await (const token of lexer.lex(chunk, { stream: true })) {
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
            for await (const token of lexer.lex()) {
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
