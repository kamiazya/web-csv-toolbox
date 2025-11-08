import { CSVLexerTransformer } from "./CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "./CSVRecordAssemblerTransformer.ts";
import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import type { DEFAULT_DELIMITER } from "./constants.ts";
import { pipeline } from "./utils/pipeline.ts";

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

  return decompression
    ? pipeline(
        stream,
        new DecompressionStream(decompression) as unknown as TransformStream<
          Uint8Array,
          Uint8Array
        >,
        new TextDecoderStream(
          charset,
          decoderOptions,
        ) as unknown as TransformStream<Uint8Array, string>,
        new CSVLexerTransformer(options),
        new CSVRecordAssemblerTransformer(options),
      )
    : pipeline(
        stream,
        new TextDecoderStream(
          charset,
          decoderOptions,
        ) as unknown as TransformStream<Uint8Array, string>,
        new CSVLexerTransformer(options),
        new CSVRecordAssemblerTransformer(options),
      );
}
