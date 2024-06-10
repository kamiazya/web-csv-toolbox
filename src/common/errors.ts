import type { Position } from "./types.js";

/**
 * Error class for invalid option errors.
 */
export class InvalidOptionError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidOptionError";
  }
}

/**
 * Options for creating a parse error.
 */
export interface ParseErrorOptions extends ErrorOptions {
  /**
   * The position where the error occurred.
   */
  position?: Position;
}

/**
 * Error class for parse errors.
 */
export class ParseError extends Error {
  /**
   * The position where the error occurred.
   */
  public position?: Position;

  constructor(message?: string, options?: ParseErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = "ParseError";
    this.position = options?.position;
  }
}
