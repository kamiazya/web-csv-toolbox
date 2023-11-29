import { RecordDelimiter, FieldDelimiter, Field } from "./common/constants";
import { Token } from "./common/types";

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
  private buffer: string = "";

  constructor() {
    super({
      transform: (
        chunk: string,
        controller: TransformStreamDefaultController<Token>
      ) => {
        this.buffer += chunk;
        let token: Token | null;
        while ((token = this.nextToken())) {
          controller.enqueue(token);
        }
      },
    });
  }

  private nextToken(): Token | null {
    if (this.buffer.length === 0) {
      return null;
    }

    // Check for CRLF
    if (this.buffer.startsWith("\r\n")) {
      this.buffer = this.buffer.slice(2);
      return { type: RecordDelimiter, value: "\r\n" };
    }

    // Check for LF
    if (this.buffer.startsWith("\n")) {
      this.buffer = this.buffer.slice(1);
      return { type: RecordDelimiter, value: "\n" };
    }

    // Check for Delimiter
    if (this.buffer.startsWith(",")) {
      this.buffer = this.buffer.slice(1);
      return { type: FieldDelimiter, value: "," };
    }

    // Check for Quoted String
    if (this.buffer.startsWith('"')) {
      return this.extractQuotedString();
    }

    // Check for Unquoted String
    const match = /^[^,"\r\n]+/.exec(this.buffer);
    if (match) {
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
      if (this.buffer[end] === '"' && this.buffer[end + 1] === '"') {
        value += '"';
        end += 2;
        continue;
      }

      // Closing quote
      if (this.buffer[end] === '"') {
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
