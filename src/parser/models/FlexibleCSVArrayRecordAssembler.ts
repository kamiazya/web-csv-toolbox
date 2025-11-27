import {
  DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  FieldDelimiter,
  RecordDelimiter,
} from "@/core/constants.ts";
import { ParseError } from "@/core/errors.ts";
import type {
  ColumnCountStrategy,
  CSVArrayRecord,
  CSVArrayRecordAssembler,
  CSVRecordAssemblerAssembleOptions,
  CSVRecordAssemblerCommonOptions,
  Token,
} from "@/core/types.ts";
import { validateMaxFieldCount } from "@/parser/utils/validateMaxFieldCount.ts";

/**
 * Flexible CSV Array Record Assembler implementation.
 *
 * A balanced implementation that assembles tokens into CSV records as arrays,
 * optimizing for both performance and memory efficiency.
 *
 * @remarks
 * This implementation is designed to handle various CSV formats flexibly
 * while maintaining good performance characteristics. For specialized use cases,
 * future implementations may provide optimizations for specific scenarios
 * (e.g., speed-optimized, memory-optimized).
 */
export class FlexibleCSVArrayRecordAssembler<
  Header extends ReadonlyArray<string>,
> implements CSVArrayRecordAssembler<Header>
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
  #includeHeader: boolean;
  #columnCountStrategy: ColumnCountStrategy;
  #headerIncluded = false; // Track if header has been included in output

  constructor(options: CSVRecordAssemblerCommonOptions<Header> = {}) {
    // Validate includeHeader option
    this.#includeHeader = options.includeHeader ?? false;

    // Validate headerless mode (header: [])
    if (
      options.header !== undefined &&
      Array.isArray(options.header) &&
      options.header.length === 0
    ) {
      // Headerless mode: only 'keep' strategy is allowed
      if (
        options.columnCountStrategy !== undefined &&
        options.columnCountStrategy !== "keep"
      ) {
        throw new Error(
          `Headerless mode (header: []) only supports columnCountStrategy: 'keep'. ` +
            `Got '${options.columnCountStrategy}'. ` +
            `For other strategies, provide a non-empty header.`,
        );
      }
    }

    // Validate and set columnCountStrategy
    this.#columnCountStrategy = options.columnCountStrategy ?? "keep";
    if (this.#columnCountStrategy !== "keep" && options.header === undefined) {
      throw new Error(
        `columnCountStrategy '${this.#columnCountStrategy}' requires header option. ` +
          `Use 'keep' or omit columnCountStrategy for headerless CSV.`,
      );
    }

    const mfc = options.maxFieldCount ?? DEFAULT_ASSEMBLER_MAX_FIELD_COUNT;
    // Validate maxFieldCount
    validateMaxFieldCount(mfc);
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
  ): IterableIterator<CSVArrayRecord<Header>> {
    const stream = options?.stream ?? false;

    // Yield header if includeHeader is enabled (before processing any records)
    yield* this.#maybeYieldHeader();

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
  *#processToken(token: Token): IterableIterator<CSVArrayRecord<Header>> {
    this.#signal?.throwIfAborted();

    // Track the current record number for error reporting
    if (token.location) {
      this.#currentRowNumber = token.location.rowNumber;
    }

    switch (token.type) {
      case FieldDelimiter:
        // Set empty string for empty fields
        if (this.#row[this.#fieldIndex] === undefined) {
          this.#row[this.#fieldIndex] = "";
        }
        this.#fieldIndex++;
        this.#checkFieldCount();
        this.#dirty = true;
        break;
      case RecordDelimiter:
        // Set empty string for the last field if empty
        if (this.#row[this.#fieldIndex] === undefined) {
          this.#row[this.#fieldIndex] = "";
        }
        if (this.#header === undefined) {
          this.#setHeader(this.#row as unknown as Header);
          // Yield header if includeHeader is enabled after header inference
          yield* this.#maybeYieldHeader();
        } else {
          if (this.#dirty) {
            yield this.#assembleRecord();
          } else {
            if (!this.#skipEmptyLines) {
              // For empty lines, generate empty record
              yield new Array(this.#header.length).fill(
                "",
              ) as unknown as CSVArrayRecord<Header>;
            }
          }
        }
        // Reset the row fields buffer.
        this.#fieldIndex = 0;
        this.#row = [];
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
  *#flush(): IterableIterator<CSVArrayRecord<Header>> {
    if (this.#header !== undefined) {
      if (this.#dirty) {
        // Set empty string for the last field if empty
        if (this.#row[this.#fieldIndex] === undefined) {
          this.#row[this.#fieldIndex] = "";
        }
        yield this.#assembleRecord();
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
    // Allow empty header for headerless mode (all rows are data)
    // Only validate duplicates when header is non-empty
    if (
      this.#header.length > 0 &&
      new Set(this.#header).size !== this.#header.length
    ) {
      throw new ParseError("The header must not contain duplicate fields.", {
        source: this.#source,
      });
    }
  }

  /**
   * Assembles a record in array format.
   * Applies column count strategy if header is defined.
   */
  #assembleRecord(): CSVArrayRecord<Header> {
    if (!this.#header) {
      // Headerless: return row as-is
      return [...this.#row] as unknown as CSVArrayRecord<Header>;
    }

    // Apply column count strategy
    const headerLength = this.#header.length;
    const rowLength = this.#row.length;

    switch (this.#columnCountStrategy) {
      case "keep":
        // Return row as-is
        return [...this.#row] as unknown as CSVArrayRecord<Header>;

      case "pad":
        // Pad short rows with undefined, truncate long rows
        if (rowLength < headerLength) {
          const padded = [...this.#row];
          while (padded.length < headerLength) {
            padded.push(undefined as unknown as string);
          }
          return padded as unknown as CSVArrayRecord<Header>;
        } else if (rowLength > headerLength) {
          return this.#row.slice(
            0,
            headerLength,
          ) as unknown as CSVArrayRecord<Header>;
        }
        return [...this.#row] as unknown as CSVArrayRecord<Header>;

      case "strict":
        // Throw error if length doesn't match
        if (rowLength !== headerLength) {
          throw new ParseError(
            `Expected ${headerLength} columns, got ${rowLength}${
              this.#currentRowNumber ? ` at row ${this.#currentRowNumber}` : ""
            }${this.#source ? ` in ${JSON.stringify(this.#source)}` : ""}`,
            {
              source: this.#source,
            },
          );
        }
        return [...this.#row] as unknown as CSVArrayRecord<Header>;

      case "truncate":
        // Truncate long rows, keep short rows as-is
        if (rowLength > headerLength) {
          return this.#row.slice(
            0,
            headerLength,
          ) as unknown as CSVArrayRecord<Header>;
        }
        return [...this.#row] as unknown as CSVArrayRecord<Header>;

      default:
        // Should never reach here due to validation
        return [...this.#row] as unknown as CSVArrayRecord<Header>;
    }
  }

  /**
   * Yields the header row if includeHeader is enabled and header hasn't been included yet.
   */
  *#maybeYieldHeader(): IterableIterator<CSVArrayRecord<Header>> {
    if (
      this.#includeHeader &&
      this.#header !== undefined &&
      !this.#headerIncluded
    ) {
      this.#headerIncluded = true;
      // Yield header as array
      yield [...this.#header] as unknown as CSVArrayRecord<Header>;
    }
  }
}
