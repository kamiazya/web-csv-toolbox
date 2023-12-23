import { CommonOptions } from "./common/types.js";
import { SingleValueReadableStream } from "./internal/SingleValueReadableStream.js";
import { parseStringStream } from "./parseStringStream.js";
import { ParserOptions } from "./transformers/index.js";

export async function* streamingParse<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: CommonOptions & ParserOptions<Header>,
): AsyncIterableIterator<Record<Header[number], string>> {
  yield* parseStringStream(new SingleValueReadableStream(csv), options);
}
