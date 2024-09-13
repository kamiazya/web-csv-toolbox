import {
  type AbortSignalOptions,
  CRLF,
  type CommonOptions,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  Field,
  FieldDelimiter,
  LF,
  ParseError,
  type Position,
  RecordDelimiter,
  type RecordDelimiterToken,
  type Token,
  assertCommonOptions,
} from "@web-csv-toolbox/common";
import { escapeRegExp } from "@web-csv-toolbox/shared";

/**
 * CSV Lexer.
 *
 * Lexter tokenizes CSV data into fields and records.
 */
export class Lexer<
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
> {
  #delimiter: string;
  #quotation: string;
  #buffer = "";
  #flush = false;
  #matcher: RegExp;
  #fieldDelimiterLength: number;

  #cursor: Position = {
    line: 1,
    column: 1,
    offset: 0,
  };
  #rowNumber = 1;

  #signal?: AbortSignal;

  /**
   * Constructs a new Lexer instance.
   * @param options - The common options for the lexer.
   */
  constructor(
    options: CommonOptions<Delimiter, Quotation> & AbortSignalOptions = {},
  ) {
    const {
      delimiter = DEFAULT_DELIMITER,
      quotation = DEFAULT_QUOTATION,
      signal,
    } = options;
    assertCommonOptions({ delimiter, quotation });
    this.#delimiter = delimiter;
    this.#quotation = quotation;
    this.#fieldDelimiterLength = delimiter.length;
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
   * @param chunk - The chunk of CSV data to be lexed.
   * @param buffering - Indicates whether the lexer is buffering or not.
   * @returns An iterable iterator of tokens.
   */
  public lex(chunk: string | null, buffering = false): IterableIterator<Token> {
    if (!buffering) {
      this.#flush = true;
    }
    if (typeof chunk === "string" && chunk.length !== 0) {
      this.#buffer += chunk;
    }

    return this.#tokens();
  }

  /**
   * Flushes the lexer and returns any remaining tokens.
   * @returns An array of tokens.
   */
  public flush(): Token[] {
    this.#flush = true;
    return [...this.#tokens()];
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
    }
  }

  /**
   * Retrieves the next token from the buffered CSV data.
   * @returns The next token or null if there are no more tokens.
   */
  #nextToken(): Token | null {
    this.#signal?.throwIfAborted();
    if (this.#buffer.length === 0) {
      return null;
    }
    // Buffer is Record Delimiter, defer to the next iteration.
    if (
      this.#flush === false &&
      (this.#buffer === CRLF || this.#buffer === LF)
    ) {
      return null;
    }

    // Check for CRLF
    if (this.#buffer.startsWith(CRLF)) {
      this.#buffer = this.#buffer.slice(2);
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
    if (this.#buffer.startsWith(LF)) {
      this.#buffer = this.#buffer.slice(1);
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
    if (this.#buffer.startsWith(this.#delimiter)) {
      this.#buffer = this.#buffer.slice(1);
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
    if (this.#buffer.startsWith(this.#quotation)) {
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
      let value = "";
      let offset = 1; // Skip the opening quote
      let column = 2; // Skip the opening quote
      let line = 0;

      // Define variables
      let cur: string = this.#buffer[offset];
      let next: string | undefined = this.#buffer[offset + 1];
      do {
        // If the current character is a quote, check the next characters for closing quotes.
        if (cur === this.#quotation) {
          // If the cur character is a quote and the next character is a quote,
          // then append a quote to the value and skip two characters.
          if (next === this.#quotation) {
            // Append a quote to the value and skip two characters.
            value += this.#quotation;
            offset += 2;
            cur = this.#buffer[offset];
            next = this.#buffer[offset + 1];

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
          this.#buffer = this.#buffer.slice(offset);
          const start: Position = { ...this.#cursor };
          this.#cursor.column += column;
          this.#cursor.offset += offset;
          this.#cursor.line += line;
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

        // Append the character to the value.
        value += cur;

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
        next = this.#buffer[offset + 1];
      } while (cur !== undefined);

      if (this.#flush) {
        throw new ParseError("Unexpected EOF while parsing quoted field.", {
          position: { ...this.#cursor },
        });
      }
      return null;
    }

    // Check for Unquoted String
    const match = this.#matcher.exec(this.#buffer);
    if (match) {
      // If we're flushing and the match doesn't consume the entire buffer,
      // then return null
      if (this.#flush === false && match[0].length === this.#buffer.length) {
        return null;
      }
      const value = match[1];
      this.#buffer = this.#buffer.slice(value.length);
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
