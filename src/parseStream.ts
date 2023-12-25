import { CSVRecord, ParseBinaryOptions } from "./common/index.js";
import { toArray } from "./internal/toArray.js";
import { parseBinaryStream } from "./parseBinaryStream.js";
import { parseStringStream } from "./parseStringStream.js";

/**
 * Parse CSV Stream to records.
 * string and Uint8Array are supported.
 *
 * @remarks
 * {@link parseStringStream} and {@link parseBinaryStream} are used internally.
 * If you known the type of the stream, it performs better to use them directly.
 *
 * If you want to parse a string, use {@link parseStringStream}.
 * If you want to parse a Uint8Array, use {@link parseBinaryStream}.
 *
 * @param csv CSV string to parse
 * @param options Parsing options. See {@link ParserOptions}.
 */
export async function* parseStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array | string>,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
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

export namespace parseStream {
  export declare function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
}

parseStream.toArray = toArray;
