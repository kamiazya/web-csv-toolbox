import { assertCommonOptions } from "./assertCommonOptions.ts";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants.ts";
import type {
  CommonOptions,
  FieldToken,
  Location,
  Token,
} from "./common/types.ts";
import { COMMA, CRLF, DOUBLE_QUOTE, LF } from "./constants.ts";
import { escapeRegExp } from "./utils/escapeRegExp.ts";

/**
 * CSV Lexer.
 *
 * Lexter tokenizes CSV data into fields and records.
 */
export class Lexer {
  #delimiter: string;
  #quotation: string;
  #buffer = "";
  #flush = false;
  #matcher: RegExp;
  #fieldDelimiterLength: number;

  #location: Location = {
    line: 1,
    column: 1,
    offset: 0,
  };
  #rowNumber = 1;

  #field(value: string, diff?: Location): FieldToken {
    const start: Location = { ...this.#location };
    this.#location.column += diff?.column ?? value.length;
    this.#location.offset += diff?.offset ?? value.length;
    this.#location.line += diff?.line ?? 0;
    return {
      type: Field,
      value,
      location: {
        start,
        end: { ...this.#location },
        rowNumber: this.#rowNumber,
      },
    };
  }

  #fieldDelimiter(): Token {
    const start: Location = { ...this.#location };
    this.#location.column += this.#fieldDelimiterLength;
    this.#location.offset += this.#fieldDelimiterLength;
    return {
      type: FieldDelimiter,
      value: this.#delimiter,
      location: {
        start,
        end: { ...this.#location },
        rowNumber: this.#rowNumber,
      },
    };
  }

  #recordDelimiter(value: string): Token {
    const start: Location = { ...this.#location };
    this.#location.line++;
    this.#location.column = 1;
    this.#location.offset += value.length;
    return {
      type: RecordDelimiter,
      value,
      location: {
        start,
        end: { ...this.#location },
        rowNumber: this.#rowNumber,
      },
    };
  }

  /**
   * Constructs a new Lexer instance.
   * @param options - The common options for the lexer.
   */
  constructor({
    delimiter = COMMA,
    quotation = DOUBLE_QUOTE,
  }: CommonOptions = {}) {
    assertCommonOptions({ delimiter, quotation });
    this.#delimiter = delimiter;
    this.#quotation = quotation;
    this.#fieldDelimiterLength = delimiter.length;
    const d = escapeRegExp(delimiter);
    const q = escapeRegExp(quotation);
    this.#matcher = new RegExp(
      `^(?:(?!${q})(?!${d})(?![\\r\\n]))([\\S\\s\\uFEFF\\xA0]+?)(?=${q}|${d}|\\r|\\n|$)`,
    );
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
    let currentField: Token | null = null;
    for (let token: Token | null; (token = this.#nextToken()); ) {
      switch (token.type) {
        case FieldDelimiter:
          if (currentField) {
            yield currentField;
            currentField = null;
          }
          yield token;
          break;
        case RecordDelimiter:
          if (currentField) {
            yield currentField;
            currentField = null;
          }
          yield token;
          break;
        default:
          // If currentField is not null, append the new token's value to it
          if (currentField) {
            currentField.value += token.value;
          } else {
            currentField = token;
          }
          break;
      }
    }
    if (currentField) {
      yield currentField;
    }
  }

  /**
   * Retrieves the next token from the buffered CSV data.
   * @returns The next token or null if there are no more tokens.
   */
  #nextToken(): Token | null {
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
      const token = this.#recordDelimiter(CRLF);
      this.#rowNumber++;
      return token;
    }

    // Check for LF
    if (this.#buffer.startsWith(LF)) {
      this.#buffer = this.#buffer.slice(1);
      const token = this.#recordDelimiter(LF);
      this.#rowNumber++;
      return token;
    }

    // Check for Delimiter
    if (this.#buffer.startsWith(this.#delimiter)) {
      this.#buffer = this.#buffer.slice(1);
      return this.#fieldDelimiter();
    }

    // Check for Quoted String
    if (this.#buffer.startsWith(this.#quotation)) {
      // If not flushing and the buffer doesn't end with a quote, then return null.
      if (this.#flush === false && this.#buffer.endsWith(this.#quotation)) {
        return null;
      }
      return this.#extractQuotedString();
    }

    // Check for Unquoted String
    const match = this.#matcher.exec(this.#buffer);
    if (match) {
      // If we're flushing and the match doesn't consume the entire buffer,
      // then return null
      if (this.#flush === false && match[0].length === this.#buffer.length) {
        return null;
      }
      this.#buffer = this.#buffer.slice(match[0].length);
      return this.#field(match[0]);
    }

    // Otherwise, return null
    return null;
  }

  /**
   * Extracts a quoted string token from the buffered CSV data.
   * @returns The quoted string token or null if the string is not properly quoted.
   */
  #extractQuotedString(): Token | null {
    /**
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
     * | #quotation | #delimiter |          | => Closing quote
     * | #quotation | (EOF)      |          | => Closing quote
     * | #quotation | undefined  |          | => End of buffer
     * | undefined  |            |          | => End of buffer
     * ```
     */
    let offset = 1; // Skip the opening quote
    let value = "";
    let column = 1;
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
        this.#buffer = this.#buffer.slice(++offset);
        return this.#field(value, { column, offset, line });
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
      cur = this.#buffer[offset];
      next = this.#buffer[offset + 1];
    } while (cur !== undefined);

    // If we get here, we've reached the end of the buffer
    return null;
    // TODO: If flash is true, the buffer is exiting unquoted and an exception should be raised.
  }
}
