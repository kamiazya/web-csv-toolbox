import { CSVRecord, ParseOptions } from "../common/types.js";
import { LexerTransformer } from "../transformers/LexerTransformer.js";
import { RecordAssemblerTransformer } from "../transformers/RecordAssemblerTransformer.js";
import { pipeline } from "./pipeline.js";

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
