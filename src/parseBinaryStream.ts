import { CSVRecord, ParseBinaryOptions } from "./common/types.js";
import { toArray } from "./internal/toArray.js";
import { parseStringStream } from "./parseStringStream.js";

/**
 * Parse CSV to records.
 * This function is for parsing a binary stream.
 *
 * @remarks
 * If you want to parse a string, use {@link streamingParse}.
 * @param stream CSV string to parse
 * @param options Parsing options. See {@link ParseBinaryOptions}.
 */
export async function* parseBinaryStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  const { charset, fatal, ignoreBOM, decomposition } = options ?? {};
  yield* parseStringStream(
    [
      // NOTE: if decompression is undefined, it will be ignored.
      ...(decomposition ? [new DecompressionStream(decomposition)] : []),
      // NOTE: if charset is undefined, it will be decoded as utf-8.
      new TextDecoderStream(charset, { fatal, ignoreBOM }),
    ].reduce<ReadableStream>(
      (stream, transformer) => stream.pipeThrough(transformer),
      stream,
    ),
    options,
  );
}

export namespace parseBinaryStream {
  export declare function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
}

parseBinaryStream.toArray = toArray;
