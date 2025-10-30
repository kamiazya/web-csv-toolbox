import { FieldDelimiter, RecordDelimiter } from "./common/constants.ts";
import { ParseError } from "./common/errors.ts";
import type {
  CSVRecord,
  RecordAssemblerOptions,
  Token,
} from "./common/types.ts";

/**
 * Default maximum field count per record (100,000 fields).
 */
const DEFAULT_MAX_FIELD_COUNT = 100_000;

export class RecordAssembler<Header extends ReadonlyArray<string>> {
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #dirty = false;
  #signal?: AbortSignal;
  #maxFieldCount: number;
  #skipEmptyLines: boolean;

  constructor(options: RecordAssemblerOptions<Header> = {}) {
    const mfc = options.maxFieldCount ?? DEFAULT_MAX_FIELD_COUNT;
    // Validate maxFieldCount
    if (
      !(Number.isFinite(mfc) || mfc === Number.POSITIVE_INFINITY) ||
      (Number.isFinite(mfc) && (mfc < 1 || !Number.isInteger(mfc)))
    ) {
      throw new RangeError(
        "maxFieldCount must be a positive integer or Number.POSITIVE_INFINITY",
      );
    }
    this.#maxFieldCount = mfc;
    this.#skipEmptyLines = options.skipEmptyLines ?? false;
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
            if (this.#skipEmptyLines && !this.#dirty) continue;
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
    if (this.#fieldIndex + 1 > this.#maxFieldCount) {
      throw new RangeError(
        `Field count (${this.#fieldIndex + 1}) exceeded maximum allowed count of ${this.#maxFieldCount}`,
      );
    }
  }

  #setHeader(header: Header) {
    if (header.length > this.#maxFieldCount) {
      throw new RangeError(
        `Header field count (${header.length}) exceeded maximum allowed count of ${this.#maxFieldCount}`,
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
