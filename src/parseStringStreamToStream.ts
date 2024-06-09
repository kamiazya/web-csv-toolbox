import { LexerTransformer } from "./LexerTransformer.ts";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";
import type { CSVRecord, ParseOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import { pipeline } from "./utils/pipeline.ts";

export function parseStringStreamToStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  try {
    return pipeline(
      stream,
      new LexerTransformer(options),
      new RecordAssemblerTransformer(options),
    );
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
