import { CSVRecord, ParseOptions } from "./common/types.js";
import { toArray } from "./internal/toArray.js";
import {
  LexerTransformer,
  RecordAssemblerTransformar,
} from "./transformers/index.js";

/**
 * Parse CSV string to records.
 *
 * @param stream CSV string stream to parse
 * @param options Parsing options. See {@link ParseOptions}.
 */
export async function* parseStringStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  let controller: ReadableStreamDefaultController;
  const readable = new ReadableStream({
    start: (controller_) => (controller = controller_),
  });
  await stream
    .pipeThrough(new LexerTransformer(options))
    .pipeThrough(new RecordAssemblerTransformar(options))
    .pipeTo(
      new WritableStream({
        write: (row) => controller.enqueue(row),
        close: () => controller.close(),
      }),
    );
  const reader = readable.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export namespace parseStringStream {
  export declare function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
}

parseStringStream.toArray = toArray;
