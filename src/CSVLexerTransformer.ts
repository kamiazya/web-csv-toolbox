import { CSVLexer } from "./CSVLexer.ts";
import type { CSVLexerTransformerOptions, Token } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";

/**
 * A transform stream that converts a stream of strings into a stream of tokens.
 *
 * @category Low-level API
 *
 * @param options - CSV-specific options (delimiter, quotation, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 1024, size: tokens => tokens.length }`)
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to the standard `TransformStream`.
 *
 * **Default Queuing Strategy:**
 * - Writable side: Counts by string length (characters). Default highWaterMark is 65536 characters (≈64KB).
 * - Readable side: Counts by number of tokens in each array. Default highWaterMark is 1024 tokens.
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
 *   .pipeTo(new WritableStream({ write(tokens) {
 *     for (const token of tokens) {
 *       console.log(token);
 *     }
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
 * @example Custom queuing strategies
 * ```ts
 * const transformer = new CSVLexerTransformer(
 *   { delimiter: ',' },
 *   { highWaterMark: 131072, size: (chunk) => chunk.length },  // 128KB of characters
 *   { highWaterMark: 2048, size: (tokens) => tokens.length },  // 2048 tokens
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
> extends TransformStream<string, Token[]> {
  public readonly lexer: CSVLexer<Delimiter, Quotation>;
  constructor(
    options: CSVLexerTransformerOptions<Delimiter, Quotation> = {},
    writableStrategy: QueuingStrategy<string> = {
      highWaterMark: 65536, // 64KB worth of characters
      size: (chunk) => chunk.length, // Count by string length (character count)
    },
    readableStrategy: QueuingStrategy<Token[]> = {
      highWaterMark: 1024, // 1024 tokens
      size: (tokens) => tokens.length, // Count by number of tokens in array
    },
  ) {
    const lexer = new CSVLexer(options);

    super(
      {
        transform: async (chunk, controller) => {
          if (chunk.length !== 0) {
            try {
              const tokens: Token[] = [];
              for (const token of lexer.lex(chunk, { stream: true })) {
                tokens.push(token);

                // Check backpressure periodically (every 100 tokens)
                if (tokens.length % 100 === 0 && controller.desiredSize !== null && controller.desiredSize <= 0) {
                  // Yield to event loop when backpressure is detected
                  await new Promise(resolve => setTimeout(resolve, 0));
                }
              }

              if (tokens.length > 0) {
                controller.enqueue(tokens);
              }
            } catch (error) {
              controller.error(error);
            }
          }
        },
        flush: async (controller) => {
          try {
            const tokens: Token[] = [];
            for (const token of lexer.lex()) {
              tokens.push(token);

              // Check backpressure periodically
              if (tokens.length % 100 === 0 && controller.desiredSize !== null && controller.desiredSize <= 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }

            if (tokens.length > 0) {
              controller.enqueue(tokens);
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
