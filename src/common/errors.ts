import type { Position } from "./types.js";

/**
 * Options for creating a parse error.
 */
export interface ParseErrorOptions extends ErrorOptions {
  /**
   * The position where the error occurred.
   */
  position?: Position;
  /**
   * The row number where the error occurred.
   */
  rowNumber?: number;
}

/**
 * Error class for parse errors.
 *
 * @remarks
 * This error is thrown when a parsing error occurs.
 * {@link ParseError} is a subclass of {@link !SyntaxError}.
 *
 * This is in reference to the specification
 * that the error thrown when a parse error occurs in the {@link !JSON.parse} function is {@link !SyntaxError}.
 */
export class ParseError extends SyntaxError {
  /**
   * The position where the error occurred.
   */
  public position?: Position;
  /**
   * The row number where the error occurred.
   */
  public rowNumber?: number;

  constructor(message?: string, options?: ParseErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = "ParseError";
    this.position = options?.position;
    this.rowNumber = options?.rowNumber;
  }
}
