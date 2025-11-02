/**
 * Converts a ReadableStream to an AsyncIterableIterator.
 *
 * This function preferentially uses the native async iteration support
 * and falls back to manual reader-based iteration for environments that
 * don't support it (primarily Safari as of 2025).
 *
 * @template T - The type of values in the stream
 * @param stream - The ReadableStream to convert
 * @returns An AsyncIterableIterator that yields values from the stream
 *
 * @example
 * ```ts
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue('chunk1');
 *     controller.enqueue('chunk2');
 *     controller.close();
 *   }
 * });
 *
 * for await (const chunk of convertStreamToAsyncIterableIterator(stream)) {
 *   console.log(chunk);
 * }
 * ```
 */
export function convertStreamToAsyncIterableIterator<T>(
  stream: ReadableStream<T>,
): AsyncIterableIterator<T> {
  // Use native async iteration if available
  // Check both that the symbol exists and that it's a function
  if (
    Symbol.asyncIterator in stream &&
    typeof (stream as any)[Symbol.asyncIterator] === "function"
  ) {
    // ReadableStream is AsyncIterable in modern environments
    // Cast to AsyncIterableIterator since the native iterator is compatible
    return (stream as AsyncIterable<T>)[Symbol.asyncIterator]() as AsyncIterableIterator<T>;
  }

  // TODO: Once Safari supports ReadableStream async iteration, this fallback
  // may no longer be necessary and this entire function could be removed in favor
  // of using ReadableStream directly as an AsyncIterable.
  // Track Safari support: https://bugs.webkit.org/show_bug.cgi?id=223619

  // Fallback for Safari
  return (async function* () {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } catch (error) {
      // Cancel the stream on error to release underlying resources
      // and signal to the source that no more data is needed
      await reader.cancel(error).catch(() => {
        // Ignore cancel errors as we're already in an error state
      });
      throw error;
    } finally {
      reader.releaseLock();
    }
  })();
}
