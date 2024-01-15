import { LexerTransformer } from "./LexerTransformer.ts";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";
import { CSVRecord, ParseOptions } from "./common/types.ts";
import { pipeline } from "./utils/pipeline.ts";

export function parseStringStreamToStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  return pipeline(
    stream,
    new LexerTransformer(options),
    new RecordAssemblerTransformer(options),
  );
}
