import { CommonOptions } from "./common/types.js";
import {
  LexerTransformer,
  ParserOptions,
  ParserTransformar,
} from "./transformers/index.js";

export async function* parseStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: CommonOptions & ParserOptions<Header>,
) {
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