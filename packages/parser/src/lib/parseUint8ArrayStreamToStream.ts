import type { CSVRecord, ParseBinaryOptions } from "@web-csv-toolbox/common";
import { pipeline } from "@web-csv-toolbox/shared";

import { LexerTransformer } from "./models/LexerTransformer";
import { RecordAssemblerTransformer } from "./models/RecordAssemblerTransformer";

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
