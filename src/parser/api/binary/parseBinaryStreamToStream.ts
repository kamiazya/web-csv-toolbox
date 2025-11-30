import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { createStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";

export function parseBinaryStreamToStream<
  Header extends readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  stream: ReadableStream<Uint8Array>,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  const { charset, fatal, ignoreBOM, decompression } = options ?? {};

  const decoderOptions: TextDecoderOptions = {};
  if (fatal !== undefined) decoderOptions.fatal = fatal;
  if (ignoreBOM !== undefined) decoderOptions.ignoreBOM = ignoreBOM;

  const lexer = createStringCSVLexer(options);
  const assembler = createCSVRecordAssembler<Header>(options);

  return (
    decompression
      ? stream
          .pipeThrough(
            new DecompressionStream(
              decompression,
            ) as unknown as TransformStream<Uint8Array, Uint8Array>,
          )
          .pipeThrough(
            new TextDecoderStream(
              charset,
              decoderOptions,
            ) as unknown as TransformStream<Uint8Array, string>,
          )
          .pipeThrough(new StringCSVLexerTransformer(lexer))
          .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
      : stream
          .pipeThrough(
            new TextDecoderStream(
              charset,
              decoderOptions,
            ) as unknown as TransformStream<Uint8Array, string>,
          )
          .pipeThrough(new StringCSVLexerTransformer(lexer))
          .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
  ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
