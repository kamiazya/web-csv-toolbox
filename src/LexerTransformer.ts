import { Lexer } from "./Lexer.ts";
import type { CommonOptions, Token } from "./common/types.ts";

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
export class LexerTransformer extends TransformStream<string, Token[]> {
  constructor(options: CommonOptions = {}) {
    const lexer = new Lexer(options);
    super({
      transform: (chunk, controller) => {
        if (chunk.length !== 0) {
          try {
            controller.enqueue([...lexer.lex(chunk, true)]);
          } catch (error) {
            controller.error(error);
          }
        }
      },
      flush: (controller) => {
        try {
          controller.enqueue(lexer.flush());
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }
}
