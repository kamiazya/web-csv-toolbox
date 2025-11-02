import { CSVLexer } from "./CSVLexer.ts";
import type { CSVLexerTransformerOptions, Token } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";

/**
 * A transform stream that converts a stream of strings into a stream of tokens.
 *
 * @category Low-level API
 *
 * @example Parse a CSV with headers by data
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
 * @example Custom queuing strategies for high-throughput scenarios
 * ```ts
 * const transformer = new CSVLexerTransformer({
 *   writableStrategy: { highWaterMark: 32 },
 *   readableStrategy: { highWaterMark: 64 },
 * });
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
  constructor(options: CSVLexerTransformerOptions<Delimiter, Quotation> = {}) {
    const lexer = new CSVLexer(options);
    const {
      writableStrategy = { highWaterMark: 8 },
      readableStrategy = { highWaterMark: 16 },
    } = options;

    super(
      {
        transform: (chunk, controller) => {
          if (chunk.length !== 0) {
            try {
              controller.enqueue([...lexer.lex(chunk, { stream: true })]);
            } catch (error) {
              controller.error(error);
            }
          }
        },
        flush: (controller) => {
          try {
            controller.enqueue([...lexer.lex()]);
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
