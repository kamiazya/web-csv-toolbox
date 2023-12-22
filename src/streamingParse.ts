import { CommonOptions } from "./common/types.js";
import { SingleValueReadableStream } from "./internal/SingleValueReadableStream.js";
import { parseStream } from "./parseStream.js";
import { ParserOptions } from "./transformers/index.js";

export async function* streamingParse<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: CommonOptions & ParserOptions<Header>,
) {
  for await (const row of parseStream(
    new SingleValueReadableStream(csv),
    options,
  ))
    yield row;
}
