import { LexerTransformer } from "./LexerTransformer.ts";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";
import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { pipeline } from "./utils/pipeline.ts";

export function parseUint8ArrayStreamToStream<Header extends readonly string[]>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const { charset, fatal, ignoreBOM = true, decomposition } = options ?? {};
  return decomposition
    ? pipeline(
        stream,
        new DecompressionStream(decomposition),
        new TextDecoderStream(charset, { fatal, ignoreBOM }),
        new LexerTransformer(options),
        new RecordAssemblerTransformer(options),
      )
    : pipeline(
        stream,
        new TextDecoderStream(charset, { fatal, ignoreBOM }),
        new LexerTransformer(options),
        new RecordAssemblerTransformer(options),
      );
}
