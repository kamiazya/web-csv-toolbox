import { CSVLexerTransformer } from "./CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "./CSVRecordAssemblerTransformer.ts";
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
        new DecompressionStream(decomposition),
        new TextDecoderStream(charset, { fatal, ignoreBOM }),
        new CSVLexerTransformer(options),
        new CSVRecordAssemblerTransformer(options),
      )
    : pipeline(
        stream,
        new TextDecoderStream(charset, { fatal, ignoreBOM }),
        new CSVLexerTransformer(options),
        new CSVRecordAssemblerTransformer(options),
      );
}
