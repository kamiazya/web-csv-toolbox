/**
 * Error class for invalid option errors.
 */
export class InvalidOptionError extends Error {
  constructor(...args: ConstructorParameters<typeof Error>) {
    super(...args);
    this.name = "InvalidOptionError";
  }
}
