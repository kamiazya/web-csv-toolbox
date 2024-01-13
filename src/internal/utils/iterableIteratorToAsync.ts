export function iterableIteratorToAsync<T>(
  iterator: IterableIterator<T>,
): AsyncIterableIterator<T> {
  return {
    async next() {
      const result = iterator.next();
      return Promise.resolve(result);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
