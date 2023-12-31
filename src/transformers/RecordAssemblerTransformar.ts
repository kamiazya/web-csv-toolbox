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
  constructor(options: RecordAssemblerOptions<Header> = {}) {
    let fieldIndex = 0;
    let row: string[] = [];
    let header: Header | undefined;
    let darty = false;
    super({
      transform: (
        token: Token,
        controller: TransformStreamDefaultController<
          Record<Header[number], string>
        >,
      ) => {
        switch (token.type) {
          case Field:
            darty = true;
            row[fieldIndex] = token.value;
            break;
          case FieldDelimiter:
            fieldIndex++;
            break;
          case RecordDelimiter:
            if (header === undefined) {
              setHeader(row as unknown as Header);
            } else {
              if (darty) {
                const record = Object.fromEntries(
                  header
                    .filter((v) => v)
                    .map((header, index) => [header, row.at(index)]),
                ) as unknown as Record<Header[number], string>;
                controller.enqueue(record);
              }
            }
            // Reset the row fields buffer.
            fieldIndex = 0;
            row = new Array(header?.length);
            darty = false;
            break;
        }
      },
      flush: (
        controller: TransformStreamDefaultController<
          Record<Header[number], string>
        >,
      ) => {
        if (fieldIndex !== 0 && header !== undefined) {
          // console.log('B', this.#row)
          if (darty) {
            const record = Object.fromEntries(
              header
                .filter((v) => v)
                .map((header, index) => [header, row.at(index)]),
            ) as unknown as Record<Header[number], string>;
            controller.enqueue(record);
          }
        }
      },
    });

    if (options.header !== undefined && Array.isArray(options.header)) {
      setHeader(options.header);
    }

    function setHeader(header_: Header) {
      header = header_;
      if (header.length === 0) {
        throw new Error("The header must not be empty.");
      }
      if (new Set(header).size !== header.length) {
        throw new Error("The header must not contain duplicate fields.");
      }
    }
  }
}
