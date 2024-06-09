export function pipeline<I, T, O>(
  stream: ReadableStream<I>,
  transformer1: TransformStream<I, T>,
  transformer2: TransformStream<T, O>,
): ReadableStream<O>;
export function pipeline<I, T1, T2, O>(
  stream: ReadableStream<I>,
  transformer1: TransformStream<I, T1>,
  transformer2: TransformStream<T1, T2>,
  transformer3: TransformStream<T2, O>,
): ReadableStream<O>;
export function pipeline<I, T1, T2, T3, O>(
  stream: ReadableStream<I>,
  transformer1: TransformStream<I, T1>,
  transformer2: TransformStream<T1, T2>,
  transformer3: TransformStream<T2, T3>,
  transformer4: TransformStream<T3, O>,
): ReadableStream<O>;
export function pipeline<I, O>(
  stream: ReadableStream<I>,
  ...transformers: TransformStream[]
): ReadableStream<O> {
  return new ReadableStream({
    start: (controller) => {
      (() =>
        transformers
          .reduce<ReadableStream>(
            (stream, transformer) => stream.pipeThrough(transformer),
            stream,
          )
          .pipeTo(
            new WritableStream({
              write: (v) => controller.enqueue(v),
              close: () => controller.close(),
            }),
          )
          .catch((error) => controller.error(error)))();
    },
  });
}
