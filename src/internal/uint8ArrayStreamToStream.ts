import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { LexerTransformer } from "../transformers/LexerTransformer.js";
import { RecordAssemblerTransformar } from "../transformers/RecordAssemblerTransformar.js";
import { pipeline } from "./streamPipeline.js";

export function uint8ArrayStreamToStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const { charset, fatal, ignoreBOM, decomposition } = options ?? {};
  return decomposition
    ? pipeline(
        stream,
        new DecompressionStream(decomposition),
        new TextDecoderStream(charset, { fatal, ignoreBOM }),
        new LexerTransformer(options),
        new RecordAssemblerTransformar(options),
      )
    : pipeline(
        stream,
        new TextDecoderStream(charset, { fatal, ignoreBOM }),
        new LexerTransformer(options),
        new RecordAssemblerTransformar(options),
      );
}
