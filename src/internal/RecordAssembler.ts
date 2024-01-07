import { Field, FieldDelimiter, RecordDelimiter } from "../common/constants.js";
import { CSVRecord, RecordAssemblerOptions, Token } from "../common/types.js";

export class RecordAssembler<Header extends ReadonlyArray<string>> {
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #darty = false;

  constructor(options: RecordAssemblerOptions<Header> = {}) {
    if (options.header !== undefined && Array.isArray(options.header)) {
      this.#setHeader(options.header);
    }
  }

  public *assemble(
    tokens: Token[],
    flush = true,
  ): Generator<CSVRecord<Header>> {
    for (const token of tokens) {
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
              yield record;
            }
          }
          // Reset the row fields buffer.
          this.#fieldIndex = 0;
          this.#row = new Array(this.#header?.length);
          this.#darty = false;
          break;
      }
    }

    if (flush) {
      yield* this.flush();
    }
  }

  public *flush(): Generator<CSVRecord<Header>> {
    if (this.#fieldIndex !== 0 && this.#header !== undefined) {
      if (this.#darty) {
        const record = Object.fromEntries(
          this.#header
            .filter((v) => v)
            .map((header, index) => [header, this.#row.at(index)]),
        ) as unknown as CSVRecord<Header>;
        yield record;
      }
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
