import { Field, FieldDelimiter, RecordDelimiter } from "../common/constants.js";
import { CommonOptions, Token } from "../common/types.js";
import { assertCommonOptions } from "./assertCommonOptions.js";
import { COMMA, CRLF, DOUBLE_QUATE, LF } from "./constants.js";
import { escapeRegExp } from "./escapeRegExp.js";

export class Lexer {
  #delimiter: string;
  #delimiterLength: number;
  #quotation: string;
  #quotationLength: number;
  #matcher: RegExp;
  #buffer = "";
  #flush = false;

  constructor({
    delimiter = COMMA,
    quotation = DOUBLE_QUATE,
  }: CommonOptions = {}) {
    assertCommonOptions({ delimiter, quotation });
    this.#delimiter = delimiter;
    this.#delimiterLength = delimiter.length;
    this.#quotation = quotation;
    this.#quotationLength = quotation.length;

    const d = escapeRegExp(delimiter);
    const q = escapeRegExp(quotation);
    this.#matcher = new RegExp(
      `^(?:(?!${q})(?!${d})(?![\\r\\n]))([\\S\\s\\uFEFF\\xA0]+?)(?=${q}|${d}|\\r|\\n|$)`,
    );
  }

  public lex(chunk: string | null, buffering = false): IterableIterator<Token> {
    if (!buffering) {
      this.#flush = true;
    }
    if (typeof chunk === "string" && chunk.length !== 0) {
      this.#buffer += chunk;
    }

    return this.#tokens();
  }

  public flush(): Token[] {
    this.#flush = true;
    return [...this.#tokens()];
  }

  *#tokens(): Generator<Token> {
    let currentField: Token | null = null;
    for (let token: Token | null; (token = this.#nextToken()); ) {
      switch (token.type) {
        case Field:
          if (currentField) {
            currentField.value += token.value;
          } else {
            currentField = token;
          }
          break;
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
      }
    }
    if (currentField) {
      yield currentField;
    }
  }

  #nextToken(): Token | null {
    if (this.#buffer.length === 0) {
      return null;
    }

    // Check for CRLF
    if (this.#buffer.startsWith(CRLF)) {
      this.#buffer = this.#buffer.slice(2);
      return { type: RecordDelimiter };
    }

    // Check for LF
    if (this.#buffer.startsWith(LF)) {
      this.#buffer = this.#buffer.slice(1);
      return { type: RecordDelimiter };
    }

    // Check for Delimiter
    if (this.#buffer.startsWith(this.#delimiter)) {
      this.#buffer = this.#buffer.slice(this.#delimiterLength);
      return { type: FieldDelimiter };
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

  #extractQuotedString(): Token | null {
    let end = this.#quotationLength; // Skip the opening quote
    let value = "";

    while (end < this.#buffer.length) {
      // Escaped quote
      if (
        this.#buffer.slice(end, end + this.#quotationLength) ===
          this.#quotation &&
        this.#buffer.slice(
          end + this.#quotationLength,
          end + this.#quotationLength * 2,
        ) === this.#quotation
      ) {
        value += this.#quotation;
        end += this.#quotationLength * 2;
        continue;
      }

      // Closing quote
      if (
        this.#buffer.slice(end, end + this.#quotationLength) === this.#quotation
      ) {
        // If flushing and the buffer doesn't end with a quote, then return null
        if (
          this.#flush === false &&
          end + this.#quotationLength < this.#buffer.length &&
          this.#buffer.slice(
            end + this.#quotationLength,
            this.#delimiterLength,
          ) !== this.#delimiter &&
          this.#buffer.slice(
            end + this.#quotationLength,
            end + this.#quotationLength + 2 /** CRLF.length */,
          ) !== CRLF &&
          this.#buffer.slice(
            end + this.#quotationLength,
            end + this.#quotationLength + 1 /** LF.length */,
          ) !== LF
        ) {
          return null;
        }

        // Otherwise, return the quoted string
        this.#buffer = this.#buffer.slice(end + this.#quotationLength);
        return { type: Field, value };
      }

      value += this.#buffer[end];
      end++;
    }

    // If we get here, we've reached the end of the buffer
    return null;
  }
}
