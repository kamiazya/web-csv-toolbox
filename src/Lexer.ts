import { assertCommonOptions } from "./assertCommonOptions.ts";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants.ts";
import type { CommonOptions, Token } from "./common/types.ts";
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
        this.#buffer = this.#buffer.slice(0, -CRLF.length);
      } else if (this.#buffer.endsWith(LF)) {
        this.#buffer = this.#buffer.slice(0, -LF.length);
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
      return {
        type: RecordDelimiter,
        value: CRLF,
      };
    }

    // Check for LF
    if (this.#buffer.startsWith(LF)) {
      this.#buffer = this.#buffer.slice(1);
      return {
        type: RecordDelimiter,
        value: LF,
      };
    }

    // Check for Delimiter
    if (this.#buffer.startsWith(this.#delimiter)) {
      this.#buffer = this.#buffer.slice(1);
      return {
        type: FieldDelimiter,
        value: this.#delimiter,
      };
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
      return { type: Field, value: match[0] };
    }

    // Otherwise, return null
    return null;
  }

  /**
   * Extracts a quoted string token from the buffered CSV data.
   * @returns The quoted string token or null if the string is not properly quoted.
   */
  #extractQuotedString(): Token | null {
    let end = 1; // Skip the opening quote
    let value = "";

    while (end < this.#buffer.length) {
      // Escaped quote
      if (
        this.#buffer.slice(end, end + 1) === this.#quotation &&
        this.#buffer.slice(end + 1, end + 1 * 2) === this.#quotation
      ) {
        value += this.#quotation;
        end += 1 * 2;
        continue;
      }

      // Closing quote
      if (this.#buffer.slice(end, end + 1) === this.#quotation) {
        // If flushing and the buffer doesn't end with a quote, then return null
        if (
          this.#flush === false &&
          end + 1 < this.#buffer.length &&
          this.#buffer.slice(end + 1, 1) !== this.#delimiter &&
          this.#buffer.slice(end + 1, end + 1 + 2 /** CRLF.length */) !==
            CRLF &&
          this.#buffer.slice(end + 1, end + 1 + 1 /** LF.length */) !== LF
        ) {
          return null;
        }

        // Otherwise, return the quoted string
        this.#buffer = this.#buffer.slice(end + 1);
        return { type: Field, value };
      }

      value += this.#buffer[end];
      end++;
    }

    // If we get here, we've reached the end of the buffer
    return null;
  }
}
