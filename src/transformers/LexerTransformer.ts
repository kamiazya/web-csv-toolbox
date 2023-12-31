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
  constructor(options?: CommonOptions);
  constructor({
    demiliter = COMMA,
    quotation = DOUBLE_QUATE,
  }: CommonOptions = {}) {
    assertCommonOptions({ demiliter, quotation });

    const demiliterLength = demiliter.length;
    const quotationLength = quotation.length;

    const d = escapeRegExp(demiliter);
    const q = escapeRegExp(quotation);
    const matcher = new RegExp(
      `^(?:(?!${q})(?!${d})(?![\\r\\n]))([\\S\\s\\uFEFF\\xA0]+?)(?=${q}|${d}|\\r|\\n|$)`,
    );
    let buffer = "";
    super({
      transform: (
        chunk: string,
        controller: TransformStreamDefaultController<Token>,
      ) => {
        if (chunk.length !== 0) {
          buffer += chunk;
          for (const token of tokens({ flush: false })) {
            controller.enqueue(token);
          }
        }
      },
      flush: (controller: TransformStreamDefaultController<Token>) => {
        for (const token of tokens({ flush: true })) {
          controller.enqueue(token);
        }
      },
    });

    function* tokens({ flush }: { flush: boolean }): Generator<Token> {
      let currentField: Token | null = null;
      for (let token: Token | null; (token = nextToken({ flush })); ) {
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

    function nextToken({ flush = false } = {}): Token | null {
      if (buffer.length === 0) {
        return null;
      }

      // Check for CRLF
      if (buffer.startsWith(CRLF)) {
        buffer = buffer.slice(2);
        return { type: RecordDelimiter, value: CRLF };
      }

      // Check for LF
      if (buffer.startsWith(LF)) {
        buffer = buffer.slice(1);
        return { type: RecordDelimiter, value: LF };
      }

      // Check for Delimiter
      if (buffer.startsWith(demiliter)) {
        buffer = buffer.slice(demiliterLength);
        return { type: FieldDelimiter, value: demiliter };
      }

      // Check for Quoted String
      if (buffer.startsWith(quotation)) {
        // If we're flushing and the buffer doesn't end with a quote, then return null
        // because we're not done with the quoted string
        if (flush === false && buffer.endsWith(quotation)) {
          return null;
        }
        return extractQuotedString();
      }

      // Check for Unquoted String
      const match = matcher.exec(buffer);
      if (match) {
        // If we're flushing and the match doesn't consume the entire buffer,
        // then return null
        if (flush === false && match[0].length === buffer.length) {
          return null;
        }
        buffer = buffer.slice(match[0].length);
        return { type: Field, value: match[0] };
      }

      // Otherwise, return null
      return null;
    }

    function extractQuotedString(): Token | null {
      let end = quotationLength; // Skip the opening quote
      let value = "";

      while (end < buffer.length) {
        // Escaped quote
        if (
          buffer.slice(end, end + quotationLength) === quotation &&
          buffer.slice(end + quotationLength, end + quotationLength * 2) ===
            quotation
        ) {
          value += quotation;
          end += quotationLength * 2;
          continue;
        }

        // Closing quote
        if (buffer.slice(end, end + quotationLength) === quotation) {
          buffer = buffer.slice(end + quotationLength);
          return { type: Field, value };
        }

        value += buffer[end];
        end++;
      }

      // If we get here, we've reached the end of the buffer
      return null;
    }
  }
}
