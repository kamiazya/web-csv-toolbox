/**
 * Small helper to recycle array instances in hot paths.
 *
 * @internal
 */
export class ReusableArrayPool<T> {
  readonly #pool: T[] = [];
  readonly #maxSize: number;

  constructor(maxSize: number = Number.POSITIVE_INFINITY) {
    this.#maxSize = maxSize;
  }

  take(factory: () => T): T {
    return this.#pool.pop() ?? factory();
  }

  release(value: T, reset?: (value: T) => void): void {
    reset?.(value);
    if (this.#pool.length < this.#maxSize) {
      this.#pool.push(value);
    }
  }
}
