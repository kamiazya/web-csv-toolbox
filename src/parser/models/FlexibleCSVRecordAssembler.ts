import {
  DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  FieldDelimiter,
  RecordDelimiter,
} from "@/core/constants.ts";
import { ParseError } from "@/core/errors.ts";
import type {
  CSVRecord,
  CSVRecordAssembler,
  CSVRecordAssemblerAssembleOptions,
  CSVRecordAssemblerOptions,
  Token,
} from "@/core/types.ts";

/**
 * Flexible CSV Record Assembler implementation.
 *
 * A balanced implementation that assembles tokens into CSV records,
 * optimizing for both performance and memory efficiency.
 *
 * @remarks
 * This implementation is designed to handle various CSV formats flexibly
 * while maintaining good performance characteristics. For specialized use cases,
 * future implementations may provide optimizations for specific scenarios
 * (e.g., speed-optimized, memory-optimized).
 */
export class FlexibleCSVRecordAssembler<Header extends ReadonlyArray<string>>
  implements CSVRecordAssembler<Header>
{
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #dirty = false;
  #signal?: AbortSignal | undefined;
  #maxFieldCount: number;
  #skipEmptyLines: boolean;
  #currentRowNumber?: number | undefined;
  #source?: string | undefined;

  constructor(options: CSVRecordAssemblerOptions<Header> = {}) {
    const mfc = options.maxFieldCount ?? DEFAULT_ASSEMBLER_MAX_FIELD_COUNT;
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
    this.#source = options.source;
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

    // Track the current record number for error reporting
    if (token.location) {
      this.#currentRowNumber = token.location.rowNumber;
    }

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
            // SAFETY: Object.fromEntries() is safe from prototype pollution.
            // See CSVRecordAssembler.prototype-safety.test.ts for details.
            yield Object.fromEntries(
              this.#header
                .map((header, index) => [header, index] as const)
                .filter(([header]) => header)
                .map(([header, index]) => [header, this.#row.at(index)]),
            ) as unknown as CSVRecord<Header>;
          } else {
            if (!this.#skipEmptyLines) {
              // SAFETY: Object.fromEntries() is safe from prototype pollution.
              // See CSVRecordAssembler.prototype-safety.test.ts for details.
              yield Object.fromEntries(
                this.#header
                  .filter((header) => header)
                  .map((header) => [header, ""]),
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
   *
   * @remarks
   * Prototype Pollution Safety:
   * This method uses Object.fromEntries() to create record objects from CSV data.
   * Object.fromEntries() is safe from prototype pollution because it creates
   * own properties (not prototype properties) even when keys like "__proto__",
   * "constructor", or "prototype" are used.
   *
   * For example, Object.fromEntries([["__proto__", "value"]]) creates an object
   * with an own property "__proto__" set to "value", which does NOT pollute
   * Object.prototype and does NOT affect other objects.
   *
   * This safety is verified by regression tests in:
   * CSVRecordAssembler.prototype-safety.test.ts
   */
  *#flush(): IterableIterator<CSVRecord<Header>> {
    if (this.#header !== undefined) {
      if (this.#dirty) {
        // SAFETY: Object.fromEntries() creates own properties, preventing prototype pollution
        // even when CSV headers contain dangerous property names like __proto__, constructor, etc.
        // See CSVRecordAssembler.prototype-safety.test.ts for verification tests.
        yield Object.fromEntries(
          this.#header
            .map((header, index) => [header, index] as const)
            .filter(([header]) => header)
            .map(([header, index]) => [header, this.#row.at(index)]),
        ) as unknown as CSVRecord<Header>;
      }
    }
  }

  #checkFieldCount(): void {
    if (this.#fieldIndex + 1 > this.#maxFieldCount) {
      throw new RangeError(
        `Field count (${this.#fieldIndex + 1}) exceeded maximum allowed count of ${this.#maxFieldCount}${
          this.#currentRowNumber ? ` at row ${this.#currentRowNumber}` : ""
        }${this.#source ? ` in ${JSON.stringify(this.#source)}` : ""}`,
      );
    }
  }

  #setHeader(header: Header) {
    if (header.length > this.#maxFieldCount) {
      throw new RangeError(
        `Header field count (${header.length}) exceeded maximum allowed count of ${this.#maxFieldCount}${
          this.#source ? ` in ${JSON.stringify(this.#source)}` : ""
        }`,
      );
    }
    this.#header = header;
    if (this.#header.length === 0) {
      throw new ParseError("The header must not be empty.", {
        source: this.#source,
      });
    }
    if (new Set(this.#header).size !== this.#header.length) {
      throw new ParseError("The header must not contain duplicate fields.", {
        source: this.#source,
      });
    }
  }
}
