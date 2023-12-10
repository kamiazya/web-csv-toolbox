import escapeStringRegexp from "escape-string-regexp";
import {
  COMMA,
  CRLF,
  DOUBLE_QUATE,
  Field,
  FieldDelimiter,
  LF,
  RecordDelimiter,
} from "./common/constants";
import { Token } from "./common/types";

export interface LexerOptions {
  /**
   * @default ','
   */
  demiliter?: string;
  /**
   * @default '"'
   */
  quoteChar?: string;
}

/**
 * A transform stream that converts a stream of tokens into a stream of rows.
 *
 * @example Parse a CSV with headers by data
 * ```ts
 * new ReadableStream({
 *  start(controller) {
 *   controller.enqueue("name,age\r\n");
 *  controller.enqueue("Alice,20\r\n");
 * controller.close();
 * }
 * })
 * .pipeThrough(new LexerTransformer())
 * .pipeTo(new WritableStream({ write(token) { console.log(token); }}));
 * // { type: Field, value: "name" }
 * // { type: FieldDelimiter, value: "," }
 * // { type: Field, value: "age" }
 * // { type: RecordDelimiter, value: "\r\n" }
 * // { type: Field, value: "Alice" }
 * // { type: FieldDelimiter, value: "," }
 * // { type: Field, value: "20" }
 * // { type: RecordDelimiter, value: "\r\n" }
 * ```
 */
export class LexerTransformer extends TransformStream<string, Token> {
  #demiliter: string;
  #quoteChar: string;
  #matcher: RegExp;
  public get demiliter(): string {
    return this.#demiliter;
  }
  public get quoteChar(): string {
    return this.#quoteChar;
  }

  private buffer = "";

  constructor({
    demiliter = COMMA,
    quoteChar = DOUBLE_QUATE,
  }: LexerOptions = {}) {
    if (typeof quoteChar === "string" && quoteChar.length !== 1) {
      throw new Error("quoteChar must be a single character");
    }
    if (typeof demiliter === "string" && demiliter.length !== 1) {
      throw new Error("demiliter must be a single character");
    }
    if (demiliter === quoteChar) {
      throw new Error("demiliter and quoteChar must be different");
    }

    super({
      transform: (
        chunk: string,
        controller: TransformStreamDefaultController<Token>,
      ) => {
        this.buffer += chunk;
        for (let token: Token | null; (token = this.nextToken()); ) {
          controller.enqueue(token);
        }
      },
      flush: (controller: TransformStreamDefaultController<Token>) => {
        for (
          let token: Token | null;
          (token = this.nextToken({ flush: true }));
        ) {
          controller.enqueue(token);
        }
      },
    });

    this.#demiliter = demiliter;
    this.#quoteChar = quoteChar;
    this.#matcher = new RegExp(
      `^[^${escapeStringRegexp(this.demiliter)}${escapeStringRegexp(
        this.quoteChar,
      )}\r\n]+`,
    );
  }

  private nextToken({ flush = false } = {}): Token | null {
    if (this.buffer.length === 0) {
      return null;
    }

    // Check for CRLF
    if (this.buffer.startsWith(CRLF)) {
      this.buffer = this.buffer.slice(2);
      return { type: RecordDelimiter, value: CRLF };
    }

    // Check for LF
    if (this.buffer.startsWith(LF)) {
      this.buffer = this.buffer.slice(1);
      return { type: RecordDelimiter, value: LF };
    }

    // Check for Delimiter
    if (this.buffer.startsWith(this.demiliter)) {
      this.buffer = this.buffer.slice(1);
      return { type: FieldDelimiter, value: this.demiliter };
    }

    // Check for Quoted String
    if (this.buffer.startsWith(this.quoteChar)) {
      // If we're flushing and the buffer doesn't end with a quote, then return null
      // because we're not done with the quoted string
      if (flush === false && this.buffer.endsWith(this.quoteChar)) {
        return null;
      }
      return this.extractQuotedString();
    }

    // Check for Unquoted String
    const match = this.#matcher.exec(this.buffer);
    if (match) {
      // If we're flushing and the match doesn't consume the entire buffer,
      // then return null
      if (flush === false && match[0].length === this.buffer.length) {
        return null;
      }
      this.buffer = this.buffer.slice(match[0].length);
      return { type: Field, value: match[0] };
    }

    // Otherwise, return null
    return null;
  }

  private extractQuotedString(): Token | null {
    let end = 1; // Skip the opening quote
    let value = "";

    while (end < this.buffer.length) {
      // Escaped quote
      if (
        this.buffer[end] === this.quoteChar &&
        this.buffer[end + 1] === this.quoteChar
      ) {
        value += this.quoteChar;
        end += 2;
        continue;
      }

      // Closing quote
      if (this.buffer[end] === this.quoteChar) {
        this.buffer = this.buffer.slice(end + 1);
        return { type: Field, value };
      }

      value += this.buffer[end];
      end++;
    }

    // If we get here, we've reached the end of the buffer
    return null;
  }
}
