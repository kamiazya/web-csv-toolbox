import { CSVLexer } from "./CSVLexer.ts";
import type {
  CSVLexerTransformerOptions,
  ExtendedQueuingStrategy,
  Token,
} from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";

/**
 * A transform stream that converts a stream of strings into a stream of tokens.
 *
 * @category Low-level API
 *
 * @param options - CSV-specific options (delimiter, quotation, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length, checkInterval: 100 }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 1024, size: () => 1, checkInterval: 100 }`)
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to the standard `TransformStream`.
 *
 * **Default Queuing Strategy:**
 * - Writable side: Counts by string length (characters). Default highWaterMark is 65536 characters (≈64KB).
 * - Readable side: Counts each token as 1. Default highWaterMark is 1024 tokens.
 *
 * **Backpressure Handling:**
 * The transformer monitors `controller.desiredSize` and yields to the event loop when backpressure
 * is detected (desiredSize ≤ 0). This prevents blocking the main thread during heavy processing
 * and allows the downstream consumer to catch up.
 *
 * These defaults are starting points based on data flow characteristics, not empirical benchmarks.
 * Optimal values depend on your runtime environment, data size, and performance requirements.
 *
 * @example Basic usage
 * ```ts
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("name,age\r\n");
 *     controller.enqueue("Alice,20\r\n");
 *     controller.close();
 *   }
 * })
 *   .pipeThrough(new CSVLexerTransformer())
 *   .pipeTo(new WritableStream({ write(token) {
 *     console.log(token);
 *   }}));
 * // { type: Field, value: "name", location: {...} }
 * // { type: FieldDelimiter, value: ",", location: {...} }
 * // { type: Field, value: "age", location: {...} }
 * // { type: RecordDelimiter, value: "\r\n", location: {...} }
 * // { type: Field, value: "Alice", location: {...} }
 * // { type: FieldDelimiter, value: ",", location: {...} }
 * // { type: Field, value: "20" }
 * // { type: RecordDelimiter, value: "\r\n", location: {...} }
 * ```
 *
 * @example Custom queuing strategies with backpressure tuning
 * ```ts
 * const transformer = new CSVLexerTransformer(
 *   { delimiter: ',' },
 *   {
 *     highWaterMark: 131072,         // 128KB of characters
 *     size: (chunk) => chunk.length, // Count by character length
 *     checkInterval: 200             // Check backpressure every 200 tokens
 *   },
 *   {
 *     highWaterMark: 2048,           // 2048 tokens
 *     size: () => 1,                 // Each token counts as 1
 *     checkInterval: 50              // Check backpressure every 50 tokens
 *   }
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
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends TransformStream<string, Token> {
  public readonly lexer: CSVLexer<Delimiter, Quotation>;

  /**
   * Yields to the event loop to allow backpressure handling.
   * Can be overridden for testing purposes.
   * @internal
   */
  protected async yieldToEventLoop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  constructor(
    options: CSVLexerTransformerOptions<Delimiter, Quotation> = {},
    writableStrategy: ExtendedQueuingStrategy<string> = {
      highWaterMark: 65536, // 64KB worth of characters
      size: (chunk) => chunk.length, // Count by string length (character count)
      checkInterval: 100, // Check backpressure every 100 tokens
    },
    readableStrategy: ExtendedQueuingStrategy<Token> = {
      highWaterMark: 1024, // 1024 tokens
      size: () => 1, // Each token counts as 1
      checkInterval: 100, // Check backpressure every 100 tokens
    },
  ) {
    const lexer = new CSVLexer(options);
    const checkInterval =
      writableStrategy.checkInterval ?? readableStrategy.checkInterval ?? 100;

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
