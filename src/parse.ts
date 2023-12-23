import { CommonOptions } from "./common/types.js";
import { parseResponse } from "./parseResponse.js";
import { parseStream } from "./parseStream.js";
import { streamingParse } from "./streamingParse.js";
import { ParserOptions } from "./transformers/index.js";

export async function* parse<Header extends ReadonlyArray<string>>(
  csv: string | ReadableStream<Uint8Array> | ReadableStream<string> | Response,
  options?: CommonOptions & ParserOptions<Header>,
) {
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

parse.toArray = async function toArray<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: CommonOptions & ParserOptions<Header>,
) {
  const rows = [];
  for await (const row of this(csv, options)) {
    rows.push(row);
  }
  return rows;
};
