import { FieldDelimiter, RecordDelimiter } from "./common/constants.ts";
import { FieldCountLimitError, ParseError } from "./common/errors.ts";
import type {
  CSVRecord,
  RecordAssemblerOptions,
  Token,
} from "./common/types.ts";

export class RecordAssembler<Header extends ReadonlyArray<string>> {
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #dirty = false;
  #signal?: AbortSignal;
  #maxFieldCount: number;

  constructor(options: RecordAssemblerOptions<Header> = {}) {
    this.#maxFieldCount = options.maxFieldCount ?? 100000;
    if (options.header !== undefined && Array.isArray(options.header)) {
      this.#setHeader(options.header);
    }
    if (options.signal) {
      this.#signal = options.signal;
    }
  }

  public *assemble(
    tokens: Iterable<Token>,
    flush = true,
  ): IterableIterator<CSVRecord<Header>> {
    for (const token of tokens) {
      this.#signal?.throwIfAborted();
      switch (token.type) {
        case FieldDelimiter:
          this.#fieldIndex++;
          this.#checkFieldCount();
          this.#dirty = true;
          break;
        case RecordDelimiter:
          if (this.#header === undefined) {
            this.#setHeader(this.#row as unknown as Header);
          } else {
            if (this.#dirty) {
              yield Object.fromEntries(
                this.#header.map((header, index) => [
                  header,
                  this.#row.at(index),
                ]),
              ) as unknown as CSVRecord<Header>;
            } else {
              yield Object.fromEntries(
                this.#header.map((header) => [header, ""]),
              ) as CSVRecord<Header>;
            }
          }
          // Reset the row fields buffer.
          this.#fieldIndex = 0;
          this.#row = new Array(this.#header?.length).fill("");
          this.#dirty = false;
          break;
        default:
          this.#dirty = true;
          this.#row[this.#fieldIndex] = token.value;
          break;
      }
    }

    if (flush) {
      yield* this.flush();
    }
  }

  public *flush(): Generator<CSVRecord<Header>> {
    if (this.#header !== undefined) {
      if (this.#dirty) {
        yield Object.fromEntries(
          this.#header
            .filter((v) => v)
            .map((header, index) => [header, this.#row.at(index)]),
        ) as unknown as CSVRecord<Header>;
      }
    }
  }

  #checkFieldCount(): void {
    if (this.#fieldIndex >= this.#maxFieldCount) {
      throw new FieldCountLimitError(
        `Field count exceeded maximum allowed count of ${this.#maxFieldCount}`,
        {
          currentCount: this.#fieldIndex + 1,
          maxCount: this.#maxFieldCount,
        },
      );
    }
  }

  #setHeader(header: Header) {
    if (header.length > this.#maxFieldCount) {
      throw new FieldCountLimitError(
        `Header field count (${header.length}) exceeded maximum allowed count of ${this.#maxFieldCount}`,
        {
          currentCount: header.length,
          maxCount: this.#maxFieldCount,
        },
      );
    }
    this.#header = header;
    if (this.#header.length === 0) {
      throw new ParseError("The header must not be empty.");
    }
    if (new Set(this.#header).size !== this.#header.length) {
      throw new ParseError("The header must not contain duplicate fields.");
    }
  }
}
