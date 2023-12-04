import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants";
import { Token } from "./common/types";

export interface HeaderAbsentParserOptions<
  Header extends ReadonlyArray<string>
> {
  header: Header;
}

export interface HeaderPresentParserOptions {
  header?: never;
}

export type ParserOptions<Header extends ReadonlyArray<string>> =
  | HeaderAbsentParserOptions<Header>
  | HeaderPresentParserOptions;

/**
 * A transform stream that converts a stream of tokens into a stream of rows.
 * @template Header The type of the header row.
 * @param options The options for the parser.
 *
 * @example Parse a CSV with headers by data
 *  ```ts
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("name,age\r\n");
 *     controller.enqueue("Alice,20\r\n");
 *     controller.enqueue("Bob,25\r\n");
 *     controller.enqueue("Charlie,30\r\n");
 *     controller.close();
 *   })
 *   .pipeThrough(new LexerTransformer())
 *   .pipeThrough(new ParserTransformar())
 *   .pipeTo(new WritableStream({ write(row) { console.log(row); }}));
 * // { name: "Alice", age: "20" }
 * // { name: "Bob", age: "25" }
 * // { name: "Charlie", age: "30" }
 * ```
 *
 * @example Parse a CSV with headers by options
 * ```ts
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("Alice,20\r\n");
 *     controller.enqueue("Bob,25\r\n");
 *     controller.enqueue("Charlie,30\r\n");
 *     controller.close();
 *   }
 * })
 * .pipeThrough(new LexerTransformer())
 * .pipeThrough(new ParserTransformar({ header: ["name", "age"] }))
 * .pipeTo(new WritableStream({ write(row) { console.log(row); }}));
 * // { name: "Alice", age: "20" }
 * // { name: "Bob", age: "25" }
 * // { name: "Charlie", age: "30" }
 * ```
 */
export class ParserTransformar<
  Header extends ReadonlyArray<string>
> extends TransformStream<Token, Record<Header[number], string | undefined>> {
  private fieldIndex = 0;
  private row: string[] = [];
  private header: Header | undefined;

  constructor(options: ParserOptions<Header> = {}) {
    super({
      transform: (
        token: Token,
        controller: TransformStreamDefaultController<
          Record<Header[number], string>
        >
      ) => {
        switch (token.type) {
          case Field:
            this.row[this.fieldIndex] = token.value;
            break;
          case FieldDelimiter:
            this.fieldIndex++;
            break;
          case RecordDelimiter:
            if (this.header === undefined) {
              this.header = this.row as unknown as Header;
            } else {
              controller.enqueue(
                // @ts-ignore
                Object.fromEntries(
                  this.header.map((header, index) => [
                    header,
                    this.row.at(index),
                  ])
                )
              );
            }
            // Reset the row fields buffer.
            this.fieldIndex = 0;
            this.row = new Array(this.header?.length);
            break;
        }
      },
      flush: (
        controller: TransformStreamDefaultController<
          Record<Header[number], string>
        >
      ) => {
        if (this.fieldIndex !== 0 && this.header !== undefined) {
          controller.enqueue(
            // @ts-ignore
            Object.fromEntries(
              this.header.map((header, index) => [header, this.row.at(index)])
            )
          );
        }
      },
    });

    if (
      options.header !== undefined &&
      Array.isArray(options.header) &&
      options.header.length > 0
    ) {
      this.header = options.header;
    }
  }
}
