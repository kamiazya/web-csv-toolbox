import { LexerTransformer } from "./LexerTransformer.ts";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";
import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { pipeline } from "./utils/pipeline.ts";

export function parseUint8ArrayStreamToStream<Header extends readonly string[]>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const { charset, fatal, ignoreBOM, decomposition } = options ?? {};
  return decomposition
    ? pipeline(
        stream,
        new DecompressionStream(decomposition) as unknown as TransformStream<
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
