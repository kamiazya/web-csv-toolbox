export async function* streamToAsyncIterableIterator<T>(
  stream: ReadableStream<T>,
): AsyncIterableIterator<T> {
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
}
