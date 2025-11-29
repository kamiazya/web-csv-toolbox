import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  AbortSignalOptions,
  CommonOptions,
  CSVLexerTransformerStreamOptions,
  Token,
} from "@/core/types.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { CSVLexerTransformer } from "@/parser/stream/CSVLexerTransformer.ts";

/**
 * Factory function to create a CSVLexerTransformer instance.
 *
 * This function internally creates a StringCSVLexer and wraps it in a CSVLexerTransformer,
 * providing a simpler API for stream-based CSV tokenization.
 *
 * @category Low-level API
 *
 * @param options - CSV lexer options including delimiter, quotation, and abort signal
 * @param streamOptions - Stream-specific options like backpressureCheckInterval
 * @param writableStrategy - Strategy for the writable side (default: `{ highWaterMark: 65536, size: chunk => chunk.length }`)
 * @param readableStrategy - Strategy for the readable side (default: `{ highWaterMark: 1024, size: () => 1 }`)
 * @returns A CSVLexerTransformer instance configured with the specified options
 *
 * @remarks
 * This factory function simplifies the creation of CSVLexerTransformer by handling
 * the lexer instantiation internally. Use this when you don't need direct access
 * to the lexer instance.
 *
 * For advanced use cases where you need to reuse a lexer or access it directly,
 * use {@link createStringCSVLexer} and {@link CSVLexerTransformer} separately.
 *
 * @example Basic usage
 * ```ts
 * import { createCSVLexerTransformer } from 'web-csv-toolbox';
 *
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("name,age\r\n");
 *     controller.enqueue("Alice,20\r\n");
 *     controller.close();
 *   }
 * })
 *   .pipeThrough(createCSVLexerTransformer())
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
 * import { createCSVLexerTransformer } from 'web-csv-toolbox';
 *
 * const tsvTransformer = createCSVLexerTransformer({
 *   delimiter: '\t'
 * });
 *
 * tsvStream.pipeThrough(tsvTransformer);
 * ```
 *
 * @example With backpressure tuning
 * ```ts
 * import { createCSVLexerTransformer } from 'web-csv-toolbox';
 *
 * const transformer = createCSVLexerTransformer(
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
export function createCSVLexerTransformer<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  options?: CommonOptions<Delimiter, Quotation> & AbortSignalOptions,
  streamOptions?: CSVLexerTransformerStreamOptions,
  writableStrategy?: QueuingStrategy<string>,
  readableStrategy?: QueuingStrategy<Token>,
): CSVLexerTransformer<Delimiter, Quotation> {
  const lexer = createStringCSVLexer<Delimiter, Quotation>(options);
  return new CSVLexerTransformer<Delimiter, Quotation>(
    lexer,
    streamOptions ?? {},
    writableStrategy,
    readableStrategy,
  );
}
