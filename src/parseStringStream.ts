import { CommonOptions } from "./common/types.js";
import { toArray } from "./internal/toArray.js";
import {
  LexerTransformer,
  ParserOptions,
  ParserTransformar,
} from "./transformers/index.js";

export async function* parseStringStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: CommonOptions & ParserOptions<Header>,
): AsyncIterableIterator<Record<Header[number], string>> {
  let controller: ReadableStreamDefaultController;
  const readable = new ReadableStream({
    start: (controller_) => (controller = controller_),
  });
  await stream
    .pipeThrough(new LexerTransformer(options))
    .pipeThrough(new ParserTransformar(options))
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
    options?: CommonOptions & ParserOptions<Header>,
  ): Promise<Record<Header[number], string>[]>;
}

parseStringStream.toArray = toArray;
