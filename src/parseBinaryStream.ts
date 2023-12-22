import { BinaryOptions, CommonOptions } from "./common/types.js";
import { parseStream } from "./parseStream.js";
import { ParserOptions } from "./transformers/index.js";

export async function* parseBinaryStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: CommonOptions & ParserOptions<Header> & BinaryOptions,
) {
  const { encoding, fatal, ignoreBOM } = options ?? {};
  for await (const row of parseStream(
    stream.pipeThrough(new TextDecoderStream(encoding, { fatal, ignoreBOM })),
    options,
  ))
    yield row;
}
