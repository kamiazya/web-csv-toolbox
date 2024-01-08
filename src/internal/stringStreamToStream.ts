import { CSVRecord, ParseOptions } from "../common/types.js";
import { LexerTransformer } from "../transformers/LexerTransformer.js";
import { RecordAssemblerTransformar } from "../transformers/RecordAssemblerTransformar.js";
import { pipeline } from "./streamPipeline.js";

export function stringStreamToStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  return pipeline(
    stream,
    new LexerTransformer(options),
    new RecordAssemblerTransformar(options),
  );
}
