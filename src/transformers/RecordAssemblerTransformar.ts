import {
  Field,
  FieldDelimiter,
  RecordAssemblerOptions,
  RecordDelimiter,
  Token,
} from "../common/index.ts";

/**
 * A transform stream that converts a stream of tokens into a stream of rows.
 * @template Header The type of the header row.
 * @param options The options for the parser.
 *
 * @category Low-level API
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
  private _fieldIndex = 0;
  private _row: string[] = [];
  private _header: Header | undefined;
  private _darty = false;

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
            this._darty = true;
            this._row[this._fieldIndex] = token.value;
            break;
          case FieldDelimiter:
            this._fieldIndex++;
            break;
          case RecordDelimiter:
            if (this._header === undefined) {
              this._setHeader(this._row as unknown as Header);
            } else {
              if (this._darty) {
                const record = Object.fromEntries(
                  this._header
                    .filter((v) => v)
                    .map((header, index) => [header, this._row.at(index)]),
                ) as unknown as Record<Header[number], string>;
                controller.enqueue(record);
              }
            }
            // Reset the row fields buffer.
            this._fieldIndex = 0;
            this._row = new Array(this._header?.length);
            this._darty = false;
            break;
        }
      },
      flush: (
        controller: TransformStreamDefaultController<
          Record<Header[number], string>
        >,
      ) => {
        if (this._fieldIndex !== 0 && this._header !== undefined) {
          // console.log('B', this.#row)
          if (this._darty) {
            const record = Object.fromEntries(
              this._header
                .filter((v) => v)
                .map((header, index) => [header, this._row.at(index)]),
            ) as unknown as Record<Header[number], string>;
            controller.enqueue(record);
          }
        }
      },
    });

    if (options.header !== undefined && Array.isArray(options.header)) {
      this._setHeader(options.header);
    }
  }

  private _setHeader(header: Header) {
    this._header = header;
    if (this._header.length === 0) {
      throw new Error("The header must not be empty.");
    }
    if (new Set(this._header).size !== this._header.length) {
      throw new Error("The header must not contain duplicate fields.");
    }
  }
}
