import { BinaryOptions, CommonOptions } from "./common/types.js";
import { parseStringStream } from "./parseStringStream.js";
import { ParserOptions } from "./transformers/index.js";

export async function* parseBinaryStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: CommonOptions & ParserOptions<Header> & BinaryOptions,
) {
  const { charset, fatal, ignoreBOM, decompression } = options ?? {};
  yield* parseStringStream(
    [
      // NOTE: if decompression is undefined, it will be ignored.
      ...(decompression ? [new DecompressionStream(decompression)] : []),
      // NOTE: if charset is undefined, it will be decoded as utf-8.
      new TextDecoderStream(charset, { fatal, ignoreBOM }),
    ].reduce<ReadableStream>(
      (stream, transformer) => stream.pipeThrough(transformer),
      stream,
    ),
    options,
  );
}
