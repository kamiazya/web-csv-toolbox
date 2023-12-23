import { CommonOptions } from "./common/types.js";
import { SingleValueReadableStream } from "./internal/SingleValueReadableStream.js";
import { toArray } from "./internal/toArray.js";
import { parseStringStream } from "./parseStringStream.js";
import { ParserOptions } from "./transformers/index.js";

export async function* streamingParse<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: CommonOptions & ParserOptions<Header>,
): AsyncIterableIterator<Record<Header[number], string>> {
  yield* parseStringStream(new SingleValueReadableStream(csv), options);
}
export namespace streamingParse {
  export declare function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: CommonOptions & ParserOptions<Header>,
  ): Promise<Record<Header[number], string>[]>;
}

streamingParse.toArray = toArray;
