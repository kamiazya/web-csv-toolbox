import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { CSVRecord, ParseOptions } from "@/core/types.ts";

/**
 * Build a CSV record stream from a string stream.
 *
 * This consolidates the repeated pattern of creating lexer, assembler,
 * and piping through transformers.
 *
 * @internal
 */
export async function buildCSVStreamPipeline<
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  sourceStream: ReadableStream<string>,
  options?: ParseOptions<Header, Delimiter, Quotation>,
): Promise<ReadableStream<CSVRecord<Header>>> {
  const { createStringCSVLexer } = await import(
    "@/parser/api/model/createStringCSVLexer.ts"
  );
  const { createCSVRecordAssembler } = await import(
    "@/parser/api/model/createCSVRecordAssembler.ts"
  );
  const { CSVLexerTransformer } = await import(
    "@/parser/stream/CSVLexerTransformer.ts"
  );
  const { CSVRecordAssemblerTransformer } = await import(
    "@/parser/stream/CSVRecordAssemblerTransformer.ts"
  );

  const lexer = createStringCSVLexer(options);
  const assembler = createCSVRecordAssembler(options);

  return sourceStream
    .pipeThrough(new CSVLexerTransformer(lexer))
    .pipeThrough(new CSVRecordAssemblerTransformer(assembler));
}

/**
 * Convert a stream to an async iterable iterator.
 * @internal
 */
export async function streamToAsyncIterator<T>(
  stream: ReadableStream<T>,
): Promise<AsyncIterableIterator<T>> {
  const { convertStreamToAsyncIterableIterator } = await import(
    "@/converters/iterators/convertStreamToAsyncIterableIterator.ts"
  );
  return convertStreamToAsyncIterableIterator(stream);
}
