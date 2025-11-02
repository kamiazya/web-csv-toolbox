import { CSVLexer } from "./CSVLexer.ts";
import type { CSVLexerTransformerOptions, Token } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";

/**
 * A transform stream that converts a stream of strings into a stream of tokens.
 *
 * @category Low-level API
 *
 * @param options - CSV-specific options (delimiter, quotation, etc.)
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 8 }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 16 }`)
 *
 * @remarks
 * Follows the Web Streams API pattern where queuing strategies are passed as
 * constructor arguments, similar to the standard `TransformStream`.
 *
 * Default highWaterMark values are starting points based on data flow characteristics,
 * not empirical benchmarks. Optimal values depend on your runtime environment,
 * data size, and performance requirements.
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
 *   { highWaterMark: 32 },  // writable
 *   { highWaterMark: 64 },  // readable
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
    writableStrategy: QueuingStrategy<string> = { highWaterMark: 8 },
    readableStrategy: QueuingStrategy<Token[]> = { highWaterMark: 16 },
  ) {
    const lexer = new CSVLexer(options);

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
