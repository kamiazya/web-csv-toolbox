import { CommonOptions, Token } from "../common/index.js";
import { Lexer } from "../internal/Lexer.js";

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
 * // { type: Field, value: "name" }
 * // { type: FieldDelimiter, value: "," }
 * // { type: Field, value: "age" }
 * // { type: RecordDelimiter, value: "\r\n" }
 * // { type: Field, value: "Alice" }
 * // { type: FieldDelimiter, value: "," }
 * // { type: Field, value: "20" }
 * // { type: RecordDelimiter, value: "\r\n" }
 * ```
 */
export class LexerTransformer extends TransformStream<string, Token[]> {
  constructor(options: CommonOptions = {}) {
    const lexer = new Lexer(options);
    super({
      transform: (chunk, controller) => {
        if (chunk.length !== 0) {
          controller.enqueue(lexer.lex(chunk, true));
        }
      },
      flush: (controller) => {
        controller.enqueue(lexer.flush());
      },
    });
  }
}
