import { LexerTransformer } from "./LexerTransformer.ts";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";
import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import { pipeline } from "./utils/pipeline.ts";

export function parseUint8ArrayStreamToStream<Header extends readonly string[]>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  try {
    const { charset, fatal, ignoreBOM, decomposition } = options ?? {};
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
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
