import { CSVRecord, ParseOptions } from "./common/types.js";
import { toArray } from "./internal/toArray.js";
import { type parseBinaryStream } from "./parseBinaryStream.js";
import { parseResponse } from "./parseResponse.js";
import { parseStream } from "./parseStream.js";
import { type parseStringStream } from "./parseStringStream.js";
import { streamingParse } from "./streamingParse.js";

/**
 * Parse CSV to records.
 *
 * {@link String}, {@link Uint8Array}, ReadableStream<string | Uint8Array> and Response are supported.
 *
 * @remarks
 * {@link streamingParse}, {@link parseBinaryStream},
 * {@link parseStringStream} and {@link parseResponse} are used internally.
 * If you known the type of the stream, it performs better to use them directly.
 *
 * If you want to parse a string, use {@link streamingParse}.
 * If you want to parse a Uint8Array, use {@link parseStream}.
 * If you want to parse a ReadableStream<string>, use {@link parseStringStream}.
 * If you want to parse a ReadableStream<Uint8Array>, use {@link parseBinaryStream}.
 * If you want to parse a Response, use {@link parseResponse}.
 *
 * @param csv CSV string to parse
 * @param options Parsing options. See {@link ParseOptions}.
 */
export async function* parse<Header extends ReadonlyArray<string>>(
  csv: string | ReadableStream<Uint8Array | string> | Response,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  switch (true) {
    case typeof csv === "string":
      yield* streamingParse(csv, options);
      break;
    case csv instanceof ReadableStream:
      yield* parseStream(csv, options);
      break;
    case csv instanceof Response:
      yield* parseResponse(csv, options);
      break;
  }
}
export namespace parse {
  export declare function toArray<Header extends ReadonlyArray<string>>(
    csv: string | ReadableStream<string | Uint8Array> | Response,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
}

parse.toArray = toArray;
