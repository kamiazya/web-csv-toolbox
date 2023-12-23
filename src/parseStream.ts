import { BinaryOptions, CommonOptions } from "./common/index.js";
import { parseBinaryStream } from "./parseBinaryStream.js";
import { parseStringStream } from "./parseStringStream.js";
import { ParserOptions } from "./transformers/ParserTransformer.js";

export async function* parseStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array> | ReadableStream<string>,
  options?: CommonOptions & ParserOptions<Header> & BinaryOptions,
) {
  const [branch1, branch2] = stream.tee();
  const reader1 = branch1.getReader();
  const { value: firstChunk } = await reader1.read();
  reader1.releaseLock();

  switch (true) {
    case typeof firstChunk === "string":
      yield* parseStringStream(branch2 as ReadableStream<string>, options);
      break;
    case firstChunk instanceof Uint8Array:
      yield* parseBinaryStream(branch2 as ReadableStream<Uint8Array>, options);
      break;
  }
}
