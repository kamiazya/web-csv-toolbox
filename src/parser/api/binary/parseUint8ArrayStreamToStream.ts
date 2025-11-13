import type { DEFAULT_DELIMITER } from "../../../core/constants.ts";
import type { CSVRecord, ParseBinaryOptions } from "../../../core/types.ts";
import { DefaultCSVLexer } from "../../models/DefaultCSVLexer.ts";
import { CSVLexerTransformer } from "../../stream/CSVLexerTransformer.ts";
import { DefaultCSVRecordAssembler } from "../../models/DefaultCSVRecordAssembler.ts";
import { CSVRecordAssemblerTransformer } from "../../stream/CSVRecordAssemblerTransformer.ts";

export function parseUint8ArrayStreamToStream<
  Header extends readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = '"',
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header, Delimiter, Quotation>,
): ReadableStream<CSVRecord<Header>> {
  const { charset, fatal, ignoreBOM, decompression } = options ?? {};

  const decoderOptions: TextDecoderOptions = {};
  if (fatal !== undefined) decoderOptions.fatal = fatal;
  if (ignoreBOM !== undefined) decoderOptions.ignoreBOM = ignoreBOM;

  const lexer = new DefaultCSVLexer(options);
  const assembler = new DefaultCSVRecordAssembler(options);

  return decompression
    ? stream
        .pipeThrough(
          new DecompressionStream(decompression) as unknown as TransformStream<
            Uint8Array,
            Uint8Array
          >,
        )
        .pipeThrough(
          new TextDecoderStream(
            charset,
            decoderOptions,
          ) as unknown as TransformStream<Uint8Array, string>,
        )
        .pipeThrough(new CSVLexerTransformer(lexer))
        .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
    : stream
        .pipeThrough(
          new TextDecoderStream(
            charset,
            decoderOptions,
          ) as unknown as TransformStream<Uint8Array, string>,
        )
        .pipeThrough(new CSVLexerTransformer(lexer))
        .pipeThrough(new CSVRecordAssemblerTransformer(assembler));
}
