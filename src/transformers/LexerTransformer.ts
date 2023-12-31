import {
  CommonOptions,
  Field,
  FieldDelimiter,
  RecordDelimiter,
  Token,
} from "../common/index.ts";
import { assertCommonOptions } from "../internal/assertCommonOptions.ts";
import { COMMA, CRLF, DOUBLE_QUATE, LF } from "../internal/constants.ts";
import { escapeRegExp } from "../internal/escapeRegExp.ts";

/**
 * A transform stream that converts a stream of tokens into a stream of rows.
 *
 * @category Low-level API
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
  private _demiliter: string;
  private _demiliterLength: number;
  private _quotation: string;
  private _quotationLength: number;
  private _matcher: RegExp;
  private _buffer = "";
  public get demiliter(): string {
    return this._demiliter;
  }
  public get quotation(): string {
    return this._quotation;
  }

  constructor({
    demiliter = COMMA,
    quotation = DOUBLE_QUATE,
  }: CommonOptions = {}) {
    assertCommonOptions({ demiliter, quotation });
    super({
      transform: (
        chunk: string,
        controller: TransformStreamDefaultController<Token>,
      ) => {
        if (chunk.length !== 0) {
          this._buffer += chunk;
          for (const token of this._tokens({ flush: false })) {
            controller.enqueue(token);
          }
        }
      },
      flush: (controller: TransformStreamDefaultController<Token>) => {
        for (const token of this._tokens({ flush: true })) {
          controller.enqueue(token);
        }
      },
    });

    this._demiliter = demiliter;
    this._demiliterLength = demiliter.length;
    this._quotation = quotation;
    this._quotationLength = quotation.length;

    const d = escapeRegExp(demiliter);
    const q = escapeRegExp(quotation);
    this._matcher = new RegExp(
      `^(?:(?!${q})(?!${d})(?![\\r\\n]))([\\S\\s\\uFEFF\\xA0]+?)(?=${q}|${d}|\\r|\\n|$)`,
    );
  }

  private *_tokens({ flush }: { flush: boolean }): Generator<Token> {
    let currentField: Token | null = null;
    for (let token: Token | null; (token = this._nextToken({ flush })); ) {
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

  private _nextToken({ flush = false } = {}): Token | null {
    if (this._buffer.length === 0) {
      return null;
    }

    // Check for CRLF
    if (this._buffer.startsWith(CRLF)) {
      this._buffer = this._buffer.slice(2);
      return { type: RecordDelimiter, value: CRLF };
    }

    // Check for LF
    if (this._buffer.startsWith(LF)) {
      this._buffer = this._buffer.slice(1);
      return { type: RecordDelimiter, value: LF };
    }

    // Check for Delimiter
    if (this._buffer.startsWith(this._demiliter)) {
      this._buffer = this._buffer.slice(this._demiliterLength);
      return { type: FieldDelimiter, value: this._demiliter };
    }

    // Check for Quoted String
    if (this._buffer.startsWith(this._quotation)) {
      // If we're flushing and the buffer doesn't end with a quote, then return null
      // because we're not done with the quoted string
      if (flush === false && this._buffer.endsWith(this._quotation)) {
        return null;
      }
      return this.extractQuotedString();
    }

    // Check for Unquoted String
    const match = this._matcher.exec(this._buffer);
    if (match) {
      // If we're flushing and the match doesn't consume the entire buffer,
      // then return null
      if (flush === false && match[0].length === this._buffer.length) {
        return null;
      }
      this._buffer = this._buffer.slice(match[0].length);
      return { type: Field, value: match[0] };
    }

    // Otherwise, return null
    return null;
  }

  private extractQuotedString(): Token | null {
    let end = this._quotationLength; // Skip the opening quote
    let value = "";

    while (end < this._buffer.length) {
      // Escaped quote
      if (
        this._buffer.slice(end, end + this._quotationLength) ===
          this.quotation &&
        this._buffer.slice(
          end + this._quotationLength,
          end + this._quotationLength * 2,
        ) === this.quotation
      ) {
        value += this.quotation;
        end += this._quotationLength * 2;
        continue;
      }

      // Closing quote
      if (
        this._buffer.slice(end, end + this._quotationLength) === this.quotation
      ) {
        this._buffer = this._buffer.slice(end + this._quotationLength);
        return { type: Field, value };
      }

      value += this._buffer[end];
      end++;
    }

    // If we get here, we've reached the end of the buffer
    return null;
  }
}
