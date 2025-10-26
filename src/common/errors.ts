import type { Position } from "./types.js";

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

  constructor(message?: string, options?: ParseErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = "ParseError";
    this.position = options?.position;
  }
}

/**
 * Options for creating a buffer overflow error.
 */
export interface BufferOverflowErrorOptions extends ErrorOptions {
  /**
   * The current buffer size in bytes.
   */
  currentSize?: number;
  /**
   * The maximum buffer size in bytes.
   */
  maxSize?: number;
}

/**
 * Error class for buffer overflow errors.
 *
 * @remarks
 * This error is thrown when the internal buffer exceeds the maximum allowed size.
 * This prevents memory exhaustion attacks via unbounded buffer growth.
 */
export class BufferOverflowError extends Error {
  /**
   * The current buffer size in bytes.
   */
  public currentSize?: number;
  /**
   * The maximum buffer size in bytes.
   */
  public maxSize?: number;

  constructor(message?: string, options?: BufferOverflowErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = "BufferOverflowError";
    this.currentSize = options?.currentSize;
    this.maxSize = options?.maxSize;
  }
}

/**
 * Options for creating a field count exceeded error.
 */
export interface FieldCountLimitErrorOptions extends ErrorOptions {
  /**
   * The current field count.
   */
  currentCount?: number;
  /**
   * The maximum field count.
   */
  maxCount?: number;
}

/**
 * Error class for field count limit exceeded errors.
 *
 * @remarks
 * This error is thrown when the number of fields in a CSV record exceeds the maximum allowed count.
 * This prevents memory exhaustion attacks via excessive column counts.
 */
export class FieldCountLimitError extends Error {
  /**
   * The current field count.
   */
  public currentCount?: number;
  /**
   * The maximum field count.
   */
  public maxCount?: number;

  constructor(message?: string, options?: FieldCountLimitErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = "FieldCountLimitError";
    this.currentCount = options?.currentCount;
    this.maxCount = options?.maxCount;
  }
}
