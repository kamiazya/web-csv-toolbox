import {
  Field,
  FieldDelimiter,
  RecordAssemblerOptions,
  RecordDelimiter,
  Token,
} from "../common/index.js";

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
 *   .pipeThrough(new RecordAssemblerTransformar())
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
 * .pipeThrough(new RecordAssemblerTransformar({ header: ["name", "age"] }))
 * .pipeTo(new WritableStream({ write(row) { console.log(row); }}));
 * // { name: "Alice", age: "20" }
 * // { name: "Bob", age: "25" }
 * // { name: "Charlie", age: "30" }
 * ```
 */
export class RecordAssemblerTransformar<
  Header extends ReadonlyArray<string>,
> extends TransformStream<Token, Record<Header[number], string | undefined>> {
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #darty = false;

  constructor(options: RecordAssemblerOptions<Header> = {}) {
    super({
      transform: (
        token: Token,
        controller: TransformStreamDefaultController<
          Record<Header[number], string>
        >,
      ) => {
        switch (token.type) {
          case Field:
            this.#darty = true;
            this.#row[this.#fieldIndex] = token.value;
            break;
          case FieldDelimiter:
            this.#fieldIndex++;
            break;
          case RecordDelimiter:
            if (this.#header === undefined) {
              this.#setHeader(this.#row as unknown as Header);
            } else {
              if (this.#darty) {
                const record = Object.fromEntries(
                  this.#header
                    .filter((v) => v)
                    .map((header, index) => [header, this.#row.at(index)]),
                ) as unknown as Record<Header[number], string>;
                controller.enqueue(record);
              }
            }
            // Reset the row fields buffer.
            this.#fieldIndex = 0;
            this.#row = new Array(this.#header?.length);
            this.#darty = false;
            break;
        }
      },
      flush: (
        controller: TransformStreamDefaultController<
          Record<Header[number], string>
        >,
      ) => {
        if (this.#fieldIndex !== 0 && this.#header !== undefined) {
          // console.log('B', this.#row)
          if (this.#darty) {
            const record = Object.fromEntries(
              this.#header
                .filter((v) => v)
                .map((header, index) => [header, this.#row.at(index)]),
            ) as unknown as Record<Header[number], string>;
            controller.enqueue(record);
          }
        }
      },
    });

    if (options.header !== undefined && Array.isArray(options.header)) {
      this.#setHeader(options.header);
    }
  }

  #setHeader(header: Header) {
    this.#header = header;
    if (this.#header.length === 0) {
      throw new Error("The header must not be empty.");
    }
    if (new Set(this.#header).size !== this.#header.length) {
      throw new Error("The header must not contain duplicate fields.");
    }
  }
}
