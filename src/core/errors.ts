import type { Position } from "@/core/types.js";

/**
 * Options for creating a parse error.
 */
export interface ParseErrorOptions extends ErrorOptions {
  /**
   * The position where the error occurred.
   */
  position?: Position | undefined;
  /**
   * The row number where the error occurred.
   *
   * @remarks
   * This represents the logical CSV row number (includes header if present),
   * useful for error reporting to users.
   */
  rowNumber?: number | undefined;
  /**
   * Source identifier (e.g., filename) for error reporting.
   *
   * @remarks
   * A human-readable identifier for the CSV source to help locate
   * which file or stream caused the error.
   */
  source?: string | undefined;
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
  public position?: Position | undefined;
  /**
   * The row number where the error occurred.
   *
   * @remarks
   * This represents the logical CSV row number (includes header if present),
   * useful for error reporting to users.
   */
  public rowNumber?: number | undefined;
  /**
   * Source identifier (e.g., filename) for error reporting.
   *
   * @remarks
   * A human-readable identifier for the CSV source to help locate
   * which file or stream caused the error.
   */
  public source?: string | undefined;

  constructor(message?: string, options?: ParseErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = "ParseError";
    this.position = options?.position;
    this.rowNumber = options?.rowNumber;
    this.source = options?.source;
  }
}
