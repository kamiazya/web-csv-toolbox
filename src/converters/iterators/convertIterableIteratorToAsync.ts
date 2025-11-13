export function convertIterableIteratorToAsync<T>(
  iterator: IterableIterator<T>,
): AsyncIterableIterator<T> {
  return {
    async next() {
      return iterator.next();
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
