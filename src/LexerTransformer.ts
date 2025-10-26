import { Lexer } from "./Lexer.ts";
import type { AbortSignalOptions, CommonOptions, Token } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";

/**
 * A transform stream that converts a stream of tokens into a stream of rows.
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
 *   .pipeThrough(new LexerTransformer())
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
 */
export class LexerTransformer<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends TransformStream<string, Token[]> {
  public readonly lexer: Lexer<Delimiter, Quotation>;
  constructor(options: CommonOptions<Delimiter, Quotation> & AbortSignalOptions = {}) {
    super({
      transform: (chunk, controller) => {
        if (chunk.length !== 0) {
          try {
            controller.enqueue([...this.lexer.lex(chunk, true)]);
          } catch (error) {
            controller.error(error);
          }
        }
      },
      flush: (controller) => {
        try {
          controller.enqueue(this.lexer.flush());
        } catch (error) {
          controller.error(error);
        }
      },
    });
    this.lexer = new Lexer(options);
  }
}
