import {
  COMMA,
  CRLF,
  CommonOptions,
  DOUBLE_QUATE,
  Field,
  FieldDelimiter,
  LF,
  RecordDelimiter,
  Token,
} from "../common/index.js";
import { escapeRegExp } from "../internal/utils.js";

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
  #demiliterLength: number;
  #quotation: string;
  #quotationLength: number;
  #matcher: RegExp;
  #buffer = "";
  public get demiliter(): string {
    return this.#demiliter;
  }
  public get quotation(): string {
    return this.#quotation;
  }

  constructor({
    demiliter = COMMA,
    quotation = DOUBLE_QUATE,
  }: CommonOptions = {}) {
    if (typeof quotation === "string" && quotation.length === 0) {
      throw new Error("quotation must not be empty");
    }
    if (typeof demiliter === "string" && demiliter.length === 0) {
      throw new Error("demiliter must not be empty");
    }

    if (demiliter.includes(quotation) || quotation.includes(demiliter)) {
      throw new Error(
        "demiliter and quotation must not include each other as a substring",
      );
    }
    super({
      transform: (
        chunk: string,
        controller: TransformStreamDefaultController<Token>,
      ) => {
        if (chunk.length !== 0) {
          this.#buffer += chunk;
          for (const token of this.#tokens({ flush: false })) {
            controller.enqueue(token);
          }
        }
      },
      flush: (controller: TransformStreamDefaultController<Token>) => {
        for (const token of this.#tokens({ flush: true })) {
          controller.enqueue(token);
        }
      },
    });

    this.#demiliter = demiliter;
    this.#demiliterLength = demiliter.length;
    this.#quotation = quotation;
    this.#quotationLength = quotation.length;

    const d = escapeRegExp(demiliter);
    const q = escapeRegExp(quotation);
    this.#matcher = new RegExp(
      `^(?:(?!${q})(?!${d})(?![\\r\\n]))([\\S\\s\\uFEFF\\xA0]+?)(?=${q}|${d}|\\r|\\n|$)`,
    );
  }

  *#tokens({ flush }: { flush: boolean }): Generator<Token> {
    let currentField: Token | null = null;
    for (let token: Token | null; (token = this.#nextToken({ flush })); ) {
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

  #nextToken({ flush = false } = {}): Token | null {
    if (this.#buffer.length === 0) {
      return null;
    }

    // Check for CRLF
    if (this.#buffer.startsWith(CRLF)) {
      this.#buffer = this.#buffer.slice(2);
      return { type: RecordDelimiter, value: CRLF };
    }

    // Check for LF
    if (this.#buffer.startsWith(LF)) {
      this.#buffer = this.#buffer.slice(1);
      return { type: RecordDelimiter, value: LF };
    }

    // Check for Delimiter
    if (this.#buffer.startsWith(this.#demiliter)) {
      this.#buffer = this.#buffer.slice(this.#demiliterLength);
      return { type: FieldDelimiter, value: this.#demiliter };
    }

    // Check for Quoted String
    if (this.#buffer.startsWith(this.#quotation)) {
      // If we're flushing and the buffer doesn't end with a quote, then return null
      // because we're not done with the quoted string
      if (flush === false && this.#buffer.endsWith(this.#quotation)) {
        return null;
      }
      return this.extractQuotedString();
    }

    // Check for Unquoted String
    const match = this.#matcher.exec(this.#buffer);
    if (match) {
      // If we're flushing and the match doesn't consume the entire buffer,
      // then return null
      if (flush === false && match[0].length === this.#buffer.length) {
        return null;
      }
      this.#buffer = this.#buffer.slice(match[0].length);
      return { type: Field, value: match[0] };
    }

    // Otherwise, return null
    return null;
  }

  private extractQuotedString(): Token | null {
    let end = this.#quotationLength; // Skip the opening quote
    let value = "";

    while (end < this.#buffer.length) {
      // Escaped quote
      if (
        this.#buffer.slice(end, end + this.#quotationLength) ===
          this.quotation &&
        this.#buffer.slice(
          end + this.#quotationLength,
          end + this.#quotationLength * 2,
        ) === this.quotation
      ) {
        value += this.quotation;
        end += this.#quotationLength * 2;
        continue;
      }

      // Closing quote
      if (
        this.#buffer.slice(end, end + this.#quotationLength) === this.quotation
      ) {
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
