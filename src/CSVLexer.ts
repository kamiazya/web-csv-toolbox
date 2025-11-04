import { assertCommonOptions } from "./assertCommonOptions.ts";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants.ts";
import { ParseError } from "./common/errors.ts";
import type {
  AbortSignalOptions,
  CommonOptions,
  Position,
  RecordDelimiterToken,
  Token,
} from "./common/types.ts";
import { CRLF, DEFAULT_DELIMITER, DEFAULT_QUOTATION, LF } from "./constants.ts";
import { escapeRegExp } from "./utils/escapeRegExp.ts";

/**
 * Default maximum buffer size in characters (UTF-16 code units).
 * Approximately 10MB for ASCII text, but may vary for non-ASCII characters.
 */
export const DEFAULT_MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * Default buffer cleanup threshold in characters.
 * When the processed buffer offset exceeds this threshold,
 * the buffer is sliced to reduce memory usage.
 *
 * @remarks
 * This value affects the balance between performance and memory usage:
 * - Smaller values: More frequent cleanup, lower memory usage, higher CPU overhead
 * - Larger values: Less frequent cleanup, higher memory usage, lower CPU overhead
 *
 * Based on comprehensive benchmarking, 4KB provides the best performance:
 * - 4KB: 640 ops/sec (optimal)
 * - 10KB: 577 ops/sec (-10%)
 * - 64KB: 631 ops/sec (-1.4%)
 *
 * @default 4096 (4KB)
 */
export const DEFAULT_BUFFER_CLEANUP_THRESHOLD = 4 * 1024;

/**
 * Options for the CSVLexer.lex method.
 */
export interface CSVLexerLexOptions {
  /**
   * If true, indicates that more chunks are expected.
   * If false or omitted, flushes remaining data.
   */
  stream?: boolean;
}

/**
 * CSV Lexer.
 *
 * CSVLexer tokenizes CSV data into fields and records.
 */
export class CSVLexer<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> {
  #delimiter: string;
  #quotation: string;
  #buffer = "";
  #bufferOffset = 0;
  #flush = false;
  #matcher: RegExp;
  #fieldDelimiterLength: number;
  #maxBufferSize: number;
  #bufferCleanupThreshold: number;

  #cursor: Position = {
    line: 1,
    column: 1,
    offset: 0,
  };
  #rowNumber = 1;

  #signal?: AbortSignal;

  /**
   * Constructs a new CSVLexer instance.
   * @param options - The common options for the lexer.
   */
  constructor(
    options: CommonOptions<Delimiter, Quotation> & AbortSignalOptions = {},
  ) {
    const {
      delimiter = DEFAULT_DELIMITER,
      quotation = DEFAULT_QUOTATION,
      maxBufferSize = DEFAULT_MAX_BUFFER_SIZE,
      bufferCleanupThreshold = DEFAULT_BUFFER_CLEANUP_THRESHOLD,
      signal,
    } = options;
    assertCommonOptions({
      delimiter,
      quotation,
      maxBufferSize,
      bufferCleanupThreshold,
    });
    this.#delimiter = delimiter;
    this.#quotation = quotation;
    this.#fieldDelimiterLength = delimiter.length;
    this.#maxBufferSize = maxBufferSize;
    this.#bufferCleanupThreshold = bufferCleanupThreshold;
    const d = escapeRegExp(delimiter);
    const q = escapeRegExp(quotation);
    this.#matcher = new RegExp(
      `^(?:(?!${q})(?!${d})(?![\\r\\n]))([\\S\\s\\uFEFF\\xA0]+?)(?=${q}|${d}|\\r|\\n|$)`,
    );
    if (signal) {
      this.#signal = signal;
    }
  }

  /**
   * Lexes the given chunk of CSV data.
   * @param chunk - The chunk of CSV data to be lexed. Omit to flush remaining data.
   * @param options - Lexer options.
   * @returns An iterable iterator of tokens.
   */
  public lex(
    chunk?: string,
    options?: CSVLexerLexOptions,
  ): IterableIterator<Token> {
    const stream = options?.stream ?? false;

    if (!stream) {
      this.#flush = true;
    }
    if (chunk !== undefined && chunk.length !== 0) {
      this.#buffer += chunk;
      this.#checkBufferSize();
    }

    return this.#tokens();
  }

  /**
   * Generates tokens from the buffered CSV data.
   * @yields Tokens from the buffered CSV data.
   */
  *#tokens(): Generator<Token> {
    if (this.#flush) {
      // Trim the last CRLF or LF
      if (this.#buffer.endsWith(CRLF)) {
        this.#buffer = this.#buffer.slice(0, -2 /* -CRLF.length */);
      } else if (this.#buffer.endsWith(LF)) {
        this.#buffer = this.#buffer.slice(0, -1 /* -LF.length */);
      }
    }
    let token: Token | null;
    while ((token = this.#nextToken())) {
      yield token;
      this.#cleanupBuffer();
    }
  }

  /**
   * Checks if the buffer size exceeds the maximum allowed size.
   * @throws {RangeError} If the buffer size exceeds the maximum.
   */
  #checkBufferSize(): void {
    const currentSize = this.#buffer.length - this.#bufferOffset;
    if (currentSize > this.#maxBufferSize) {
      throw new RangeError(
        `Buffer size (${currentSize} characters) exceeded maximum allowed size of ${this.#maxBufferSize} characters`,
      );
    }
  }

  /**
   * Cleans up processed portion of the buffer to reduce memory usage.
   * Called periodically when buffer offset exceeds a threshold.
   *
   * @remarks
   * If bufferCleanupThreshold is 0, cleanup is disabled.
   */
  #cleanupBuffer(): void {
    // Only cleanup if threshold is positive and we've processed a significant amount
    if (
      this.#bufferCleanupThreshold > 0 &&
      this.#bufferOffset > this.#bufferCleanupThreshold
    ) {
      this.#buffer = this.#buffer.slice(this.#bufferOffset);
      this.#bufferOffset = 0;
    }
  }

  /**
   * Checks if the buffer at current offset starts with delimiter.
   * @returns true if starts with delimiter
   */
  #startsWithDelimiter(): boolean {
    const len = this.#delimiter.length;
    if (this.#bufferOffset + len > this.#buffer.length) {
      return false;
    }
    for (let i = 0; i < len; i++) {
      if (this.#buffer[this.#bufferOffset + i] !== this.#delimiter[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Checks if the buffer at current offset starts with quotation.
   * @returns true if starts with quotation
   */
  #startsWithQuotation(): boolean {
    const len = this.#quotation.length;
    if (this.#bufferOffset + len > this.#buffer.length) {
      return false;
    }
    for (let i = 0; i < len; i++) {
      if (this.#buffer[this.#bufferOffset + i] !== this.#quotation[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Retrieves the next token from the buffered CSV data.
   * @returns The next token or null if there are no more tokens.
   */
  #nextToken(): Token | null {
    this.#signal?.throwIfAborted();
    const remainingLength = this.#buffer.length - this.#bufferOffset;
    if (remainingLength === 0) {
      return null;
    }
    // Buffer is Record Delimiter, defer to the next iteration.
    if (this.#flush === false) {
      if (
        remainingLength === 2 &&
        this.#buffer[this.#bufferOffset] === "\r" &&
        this.#buffer[this.#bufferOffset + 1] === "\n"
      ) {
        return null;
      }
      if (remainingLength === 1 && this.#buffer[this.#bufferOffset] === "\n") {
        return null;
      }
    }

    // Check for CRLF
    if (
      this.#buffer[this.#bufferOffset] === "\r" &&
      this.#buffer[this.#bufferOffset + 1] === "\n"
    ) {
      this.#bufferOffset += 2;
      const start: Position = { ...this.#cursor };
      this.#cursor.line++;
      this.#cursor.column = 1;
      this.#cursor.offset += 2; // CRLF.length
      const token: RecordDelimiterToken = {
        type: RecordDelimiter,
        value: CRLF,
        location: {
          start,
          end: { ...this.#cursor },
          rowNumber: this.#rowNumber++,
        },
      };
      return token;
    }

    // Check for LF
    if (this.#buffer[this.#bufferOffset] === "\n") {
      this.#bufferOffset += 1;
      const start: Position = { ...this.#cursor };
      this.#cursor.line++;
      this.#cursor.column = 1;
      this.#cursor.offset += 1; // LF.length
      const token: RecordDelimiterToken = {
        type: RecordDelimiter,
        value: LF,
        location: {
          start,
          end: { ...this.#cursor },
          rowNumber: this.#rowNumber++,
        },
      };
      return token;
    }

    // Check for Delimiter
    if (this.#startsWithDelimiter()) {
      this.#bufferOffset += this.#fieldDelimiterLength;
      const start: Position = { ...this.#cursor };
      this.#cursor.column += this.#fieldDelimiterLength;
      this.#cursor.offset += this.#fieldDelimiterLength;
      return {
        type: FieldDelimiter,
        value: this.#delimiter,
        location: {
          start,
          end: { ...this.#cursor },
          rowNumber: this.#rowNumber,
        },
      };
    }

    // Check for Quoted String
    if (this.#startsWithQuotation()) {
      /**
       * Extract Quoted field.
       *
       * The following code is equivalent to the following:
       *
       * If the next character is a quote:
       * - If the character after that is a quote, then append a quote to the value and skip two characters.
       * - Otherwise, return the quoted string.
       * Otherwise, append the character to the value and skip one character.
       *
       * ```plaintext
       * | `i`        | `i + 1`    | `i + 2`  |
       * |------------|------------|----------|
       * | cur        | next       |          | => Variable names
       * | #quotation | #quotation |          | => Escaped quote
       * | #quotation | (EOF)      |          | => Closing quote
       * | #quotation | undefined  |          | => End of buffer
       * | undefined  |            |          | => End of buffer
       * ```
       */
      const parts: string[] = [];
      let offset = 1; // Skip the opening quote
      let column = 2; // Skip the opening quote
      let line = 0;

      // Define variables
      let cur: string = this.#buffer[this.#bufferOffset + offset];
      let next: string | undefined =
        this.#buffer[this.#bufferOffset + offset + 1];
      do {
        // If the current character is a quote, check the next characters for closing quotes.
        if (cur === this.#quotation) {
          // If the cur character is a quote and the next character is a quote,
          // then append a quote to the value and skip two characters.
          if (next === this.#quotation) {
            // Append a quote to the value and skip two characters.
            parts.push(this.#quotation);
            offset += 2;
            cur = this.#buffer[this.#bufferOffset + offset];
            next = this.#buffer[this.#bufferOffset + offset + 1];

            // Update the diff
            column += 2;
            continue;
          }

          // If the cur character is a quote and the next character is undefined,
          // then return null.
          if (next === undefined && this.#flush === false) {
            return null;
          }

          // Otherwise, return the quoted string.
          // Update the buffer and return the token
          offset++;
          this.#bufferOffset += offset;
          const start: Position = { ...this.#cursor };
          this.#cursor.column += column;
          this.#cursor.offset += offset;
          this.#cursor.line += line;
          return {
            type: Field,
            value: parts.join(""),
            location: {
              start,
              end: { ...this.#cursor },
              rowNumber: this.#rowNumber,
            },
          };
        }

        // Append the character to the value.
        parts.push(cur);

        // Prepare for the next iteration
        if (cur === LF) {
          // If the current character is a LF,
          // then increment the line number and reset the column number.
          line++;
          column = 1;
        } else {
          // Otherwise, increment the column number and offset.
          column++;
        }

        offset++;
        cur = next;
        next = this.#buffer[this.#bufferOffset + offset + 1];
      } while (cur !== undefined);

      if (this.#flush) {
        throw new ParseError("Unexpected EOF while parsing quoted field.", {
          position: { ...this.#cursor },
        });
      }
      return null;
    }

    // Check for Unquoted String
    // Note: We need to create a substring here for regex matching
    const remaining = this.#buffer.substring(this.#bufferOffset);
    const match = this.#matcher.exec(remaining);
    if (match) {
      // If we're flushing and the match doesn't consume the entire buffer,
      // then return null
      if (this.#flush === false && match[0].length === remaining.length) {
        return null;
      }
      const value = match[1];
      this.#bufferOffset += value.length;
      const start: Position = { ...this.#cursor };
      this.#cursor.column += value.length;
      this.#cursor.offset += value.length;
      return {
        type: Field,
        value,
        location: {
          start,
          end: { ...this.#cursor },
          rowNumber: this.#rowNumber,
        },
      };
    }

    // Otherwise, return null
    return null;
  }
}
