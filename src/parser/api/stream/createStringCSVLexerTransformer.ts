import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  AbortSignalOptions,
  CommonOptions,
  EngineOptions,
  StringCSVLexerTransformerStreamOptions,
  Token,
} from "@/core/types.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";

/**
 * Options for creating a StringCSVLexerTransformer via factory function.
 *
 * @category Types
 */
export interface StringCSVLexerOptions<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> extends CommonOptions<Delimiter, Quotation>,
    AbortSignalOptions,
    EngineOptions {}

/**
 * Factory function to create a StringCSVLexerTransformer instance.
 *
 * This function internally creates a StringCSVLexer and wraps it in a StringCSVLexerTransformer,
 * providing a simpler API for stream-based CSV tokenization.
 *
 * @category Mid-level API
 *
 * @param options - CSV lexer options including delimiter, quotation, abort signal, and engine
 * @param streamOptions - Stream-specific options like backpressureCheckInterval
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 1024, size: () => 1 }`)
 * @returns A StringCSVLexerTransformer instance configured with the specified options
 *
 * @see {@link https://github.com/kamiazya/web-csv-toolbox/blob/main/docs/how-to-guides/choosing-the-right-api.md | Choosing the Right API} for guidance on selecting the appropriate API level.
 *
 * @example Basic tokenization
 * ```ts
 * import { createStringCSVLexerTransformer } from 'web-csv-toolbox';
 *
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("name,age\r\n");
 *     controller.enqueue("Alice,20\r\n");
 *     controller.close();
 *   }
 * })
 *   .pipeThrough(createStringCSVLexerTransformer())
 *   .pipeTo(new WritableStream({ write(token) {
 *     console.log(token);
 *   }}));
 * // { type: Field, value: "name", location: {...} }
 * // { type: FieldDelimiter, value: ",", location: {...} }
 * // ...
 * ```
 *
 * @example Custom delimiter (TSV)
 * ```ts
 * import { createStringCSVLexerTransformer } from 'web-csv-toolbox';
 *
 * const tsvTransformer = createStringCSVLexerTransformer({
 *   delimiter: '\t'
 * });
 *
 * tsvStream.pipeThrough(tsvTransformer);
 * ```
 *
 * @example With backpressure tuning
 * ```ts
 * import { createStringCSVLexerTransformer } from 'web-csv-toolbox';
 *
 * const transformer = createStringCSVLexerTransformer(
 *   { delimiter: ',' },
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
export function createStringCSVLexerTransformer<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  options?: StringCSVLexerOptions<Delimiter, Quotation>,
  streamOptions?: StringCSVLexerTransformerStreamOptions,
  writableStrategy?: QueuingStrategy<string>,
  readableStrategy?: QueuingStrategy<Token>,
): StringCSVLexerTransformer<Delimiter, Quotation> {
  const lexer = createStringCSVLexer<Delimiter, Quotation>(options);
  return new StringCSVLexerTransformer<Delimiter, Quotation>(
    lexer,
    streamOptions ?? {},
    writableStrategy,
    readableStrategy,
  );
}
