/**
 * Error class for invalid setting errors.
 */
export class InvalidSettingError extends Error {
  constructor(...args: ConstructorParameters<typeof Error>) {
    super(...args);
    this.name = "InvalidSettingError";
  }
}
