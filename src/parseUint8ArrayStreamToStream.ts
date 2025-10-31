import { LexerTransformer } from "./LexerTransformer.ts";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";
import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
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
  return decompression
    ? pipeline(
        stream,
        new DecompressionStream(decompression) as unknown as TransformStream<
          Uint8Array,
          Uint8Array
        >,
        new TextDecoderStream(charset, {
          fatal,
          ignoreBOM,
        }) as unknown as TransformStream<Uint8Array, string>,
        new LexerTransformer(options),
        new RecordAssemblerTransformer(options),
      )
    : pipeline(
        stream,
        new TextDecoderStream(charset, {
          fatal,
          ignoreBOM,
        }) as unknown as TransformStream<Uint8Array, string>,
        new LexerTransformer(options),
        new RecordAssemblerTransformer(options),
      );
}
