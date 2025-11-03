import { FieldDelimiter, RecordDelimiter } from "./common/constants.ts";
import { ParseError } from "./common/errors.ts";
import type {
  CSVRecord,
  CSVRecordAssemblerOptions,
  Token,
} from "./common/types.ts";

/**
 * Default maximum field count per record (100,000 fields).
 */
const DEFAULT_MAX_FIELD_COUNT = 100_000;

/**
 * Options for the CSVRecordAssembler.assemble method.
 */
export interface CSVRecordAssemblerAssembleOptions {
  /**
   * If true, indicates that more tokens are expected.
   * If false or omitted, flushes remaining data.
   */
  stream?: boolean;
}

/**
 * CSV Record Assembler.
 *
 * CSVRecordAssembler assembles tokens into CSV records.
 */
export class CSVRecordAssembler<Header extends ReadonlyArray<string>> {
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #dirty = false;
  #signal?: AbortSignal;
  #maxFieldCount: number;
  #skipEmptyLines: boolean;

  constructor(options: CSVRecordAssemblerOptions<Header> = {}) {
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

  /**
   * Assembles tokens into CSV records.
   * @param input - A single token or an iterable of tokens. Omit to flush remaining data.
   * @param options - Assembler options.
   * @returns An iterable iterator of CSV records.
   */
  public *assemble(
    input?: Token | Iterable<Token>,
    options?: CSVRecordAssemblerAssembleOptions,
  ): IterableIterator<CSVRecord<Header>> {
    const stream = options?.stream ?? false;

    if (input !== undefined) {
      // Check if input is iterable (has Symbol.iterator)
      if (this.#isIterable(input)) {
        for (const token of input) {
          yield* this.#processToken(token);
        }
      } else {
        // Single token
        yield* this.#processToken(input);
      }
    }

    if (!stream) {
      yield* this.#flush();
    }
  }

  /**
   * Checks if a value is iterable.
   */
  #isIterable(value: any): value is Iterable<Token> {
    return value != null && typeof value[Symbol.iterator] === "function";
  }

  /**
   * Processes a single token and yields a record if one is completed.
   */
  *#processToken(token: Token): IterableIterator<CSVRecord<Header>> {
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
            if (!this.#skipEmptyLines) {
              yield Object.fromEntries(
                this.#header.map((header) => [header, ""]),
              ) as CSVRecord<Header>;
            }
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

  /**
   * Flushes any remaining buffered data as a final record.
   */
  *#flush(): IterableIterator<CSVRecord<Header>> {
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
