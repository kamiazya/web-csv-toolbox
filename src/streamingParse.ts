import { CSVRecord, ParseOptions } from "./common/types.js";
import { SingleValueReadableStream } from "./internal/SingleValueReadableStream.js";
import { toArray } from "./internal/toArray.js";
import { parseStringStream } from "./parseStringStream.js";

/**
 * Parse CSV string to records.
 *
 * @param csv CSV string to parse
 * @param options Parsing options. See {@link ParseOptions}.
 */
export async function* streamingParse<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  yield* parseStringStream(new SingleValueReadableStream(csv), options);
}
export namespace streamingParse {
  export declare function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
}

streamingParse.toArray = toArray;
