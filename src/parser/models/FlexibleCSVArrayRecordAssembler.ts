import {
  DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  Delimiter,
} from "@/core/constants.ts";
import { ParseError } from "@/core/errors.ts";
import type {
  AnyToken,
  ColumnCountStrategy,
  CSVArrayRecord,
  CSVRecordAssemblerAssembleOptions,
  CSVRecordAssemblerCommonOptions,
} from "@/core/types.ts";

/**
 * Flexible CSV Array Record Assembler implementation.
 *
 * An optimized assembler that works with unified field tokens.
 * No switch statement needed - simply processes each field and checks
 * the `delimiter` property to determine when a record is complete.
 *
 * @remarks
 * This implementation provides better performance by eliminating
 * the token type switch statement and reducing token iteration count by 50%.
 */
export class FlexibleCSVArrayRecordAssembler<
  const Header extends ReadonlyArray<string>,
> {
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #signal?: AbortSignal | undefined;
  #maxFieldCount: number;
  #skipEmptyLines: boolean;
  #currentRowNumber?: number | undefined;
  #source?: string | undefined;
  #includeHeader: boolean;
  #columnCountStrategy: ColumnCountStrategy;
  #headerIncluded = false;

  #assembleRecordFn:
    | ((rowLength: number) => CSVArrayRecord<Header>)
    | undefined;
  #headerLength = 0;
  #hasContent = false;
  #emptyRecordTemplate: string[] | undefined;
  #rowLength = 0;

  constructor(options: CSVRecordAssemblerCommonOptions<Header> = {}) {
    this.#includeHeader = options.includeHeader ?? false;

    // Detect headerless mode (header: [])
    const isHeaderlessMode =
      options.header !== undefined &&
      Array.isArray(options.header) &&
      options.header.length === 0;

    if (isHeaderlessMode) {
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

    // Default to "keep" for headerless mode, "fill" otherwise
    this.#columnCountStrategy =
      options.columnCountStrategy ?? (isHeaderlessMode ? "keep" : "fill");
    if (
      this.#columnCountStrategy !== "keep" &&
      this.#columnCountStrategy !== "fill" &&
      options.header === undefined
    ) {
      throw new Error(
        `columnCountStrategy '${this.#columnCountStrategy}' requires header option. ` +
          `Use 'keep', 'fill', or omit columnCountStrategy for headerless CSV.`,
      );
    }

    const mfc = options.maxFieldCount ?? DEFAULT_ASSEMBLER_MAX_FIELD_COUNT;
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
    input?: AnyToken | Iterable<AnyToken>,
    options?: CSVRecordAssemblerAssembleOptions,
  ): IterableIterator<CSVArrayRecord<Header>> {
    const stream = options?.stream ?? false;

    yield* this.#maybeYieldHeader();

    if (input !== undefined) {
      if (this.#isIterable(input)) {
        for (const token of input) {
          yield* this.#processToken(token);
        }
      } else {
        yield* this.#processToken(input);
      }
    }

    if (!stream) {
      yield* this.#flush();
    }
  }

  #isIterable(value: any): value is Iterable<AnyToken> {
    return value != null && typeof value[Symbol.iterator] === "function";
  }

  /**
   * Processes a single token.
   * No switch needed - always a field, just check what follows.
   */
  *#processToken(token: AnyToken): IterableIterator<CSVArrayRecord<Header>> {
    this.#signal?.throwIfAborted();

    // Track row number for error reporting
    if ("location" in token && token.location) {
      this.#currentRowNumber = token.location.rowNumber;
    }

    // Store the field value and track if row has content
    const value = token.value;
    this.#row[this.#fieldIndex] = value;
    if (value !== "") {
      this.#hasContent = true;
    }
    this.#rowLength = Math.max(this.#rowLength, this.#fieldIndex + 1);

    // Check what follows this field
    switch (token.delimiter) {
      case Delimiter.Field: {
        this.#fieldIndex++;
        this.#checkFieldCount();
        this.#rowLength = Math.max(this.#rowLength, this.#fieldIndex + 1);
        break;
      }
      default: {
        // End of record - yield assembled record
        const rowLength = this.#rowLength || this.#fieldIndex + 1 || 0;
        if (this.#header === undefined) {
          const headerRow = this.#takeRow(rowLength);
          this.#setHeader(headerRow as unknown as Header);
          yield* this.#maybeYieldHeader();
        } else {
          // Check if row has any non-empty content (tracked incrementally)
          if (this.#hasContent) {
            yield this.#assembleRecord(rowLength);
          } else if (!this.#skipEmptyLines) {
            this.#resetRowBuilderState();
            yield this.#createEmptyRecord();
          } else {
            this.#resetRowBuilderState();
          }
        }
        break;
      }
    }
  }

  *#flush(): IterableIterator<CSVArrayRecord<Header>> {
    // Nothing to flush - unified tokens always complete records
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
    if (
      this.#header.length > 0 &&
      new Set(this.#header).size !== this.#header.length
    ) {
      throw new ParseError("The header must not contain duplicate fields.", {
        source: this.#source,
      });
    }

    this.#headerLength = header.length;
    this.#emptyRecordTemplate = undefined;
    switch (this.#columnCountStrategy) {
      case "fill":
        this.#assembleRecordFn = this.#assembleRecordFill;
        break;
      case "sparse":
        this.#assembleRecordFn = this.#assembleRecordSparse;
        break;
      case "keep":
        this.#assembleRecordFn = this.#assembleRecordKeep;
        break;
      case "strict":
        this.#assembleRecordFn = this.#assembleRecordStrict;
        break;
      case "truncate":
        this.#assembleRecordFn = this.#assembleRecordTruncate;
        break;
      default:
        this.#assembleRecordFn = this.#assembleRecordFill;
        break;
    }
    this.#row = this.#allocateRowBuffer(this.#headerLength);
    this.#rowLength = 0;
  }

  #assembleRecord(rowLength: number): CSVArrayRecord<Header> {
    if (!this.#assembleRecordFn) {
      return this.#takeRow(rowLength) as unknown as CSVArrayRecord<Header>;
    }
    return this.#assembleRecordFn(rowLength);
  }

  #assembleRecordKeep = (rowLength: number): CSVArrayRecord<Header> => {
    const record = this.#takeRow(rowLength);
    record.length = rowLength;
    return record as unknown as CSVArrayRecord<Header>;
  };

  #assembleRecordFill = (rowLength: number): CSVArrayRecord<Header> => {
    const headerLength = this.#headerLength;
    const record = this.#takeRow(rowLength);

    if (rowLength < headerLength) {
      for (let i = rowLength; i < headerLength; i++) {
        record[i] = "";
      }
      record.length = headerLength;
      return record as unknown as CSVArrayRecord<Header>;
    } else if (rowLength > headerLength) {
      record.length = headerLength;
      return record as unknown as CSVArrayRecord<Header>;
    }
    record.length = rowLength;
    return record as unknown as CSVArrayRecord<Header>;
  };

  #assembleRecordSparse = (rowLength: number): CSVArrayRecord<Header> => {
    const headerLength = this.#headerLength;
    const record = this.#takeRow(rowLength);

    if (rowLength < headerLength) {
      for (let i = rowLength; i < headerLength; i++) {
        record[i] = undefined as unknown as string;
      }
      record.length = headerLength;
      return record as unknown as CSVArrayRecord<Header>;
    } else if (rowLength > headerLength) {
      record.length = headerLength;
      return record as unknown as CSVArrayRecord<Header>;
    }
    record.length = rowLength;
    return record as unknown as CSVArrayRecord<Header>;
  };

  #assembleRecordStrict = (rowLength: number): CSVArrayRecord<Header> => {
    const headerLength = this.#headerLength;

    if (rowLength !== headerLength) {
      this.#takeRow(rowLength);
      throw new ParseError(
        `Expected ${headerLength} columns, got ${rowLength}${
          this.#currentRowNumber ? ` at row ${this.#currentRowNumber}` : ""
        }${this.#source ? ` in ${JSON.stringify(this.#source)}` : ""}`,
        {
          source: this.#source,
        },
      );
    }
    const record = this.#takeRow(rowLength);
    record.length = headerLength;
    return record as unknown as CSVArrayRecord<Header>;
  };

  #assembleRecordTruncate = (rowLength: number): CSVArrayRecord<Header> => {
    const headerLength = this.#headerLength;
    const record = this.#takeRow(rowLength);

    if (rowLength > headerLength) {
      record.length = headerLength;
      return record as unknown as CSVArrayRecord<Header>;
    }
    record.length = rowLength;
    return record as unknown as CSVArrayRecord<Header>;
  };

  #takeRow(rowLength: number): string[] {
    const record = this.#row;
    record.length = rowLength;
    const capacityHint =
      this.#headerLength > 0 ? this.#headerLength : Math.max(rowLength, 4);
    this.#row = this.#allocateRowBuffer(capacityHint);
    this.#resetRowBuilderState(true);
    return record;
  }

  #resetRowBuilderState(replacedBuffer = false): void {
    this.#fieldIndex = 0;
    this.#rowLength = 0;
    this.#hasContent = false;
    if (!replacedBuffer) {
      this.#row.length = 0;
    }
  }

  #allocateRowBuffer(capacityHint: number): string[] {
    if (capacityHint <= 0) {
      return [];
    }
    return new Array(capacityHint);
  }

  #createEmptyRecord(): CSVArrayRecord<Header> {
    if (this.#headerLength === 0) {
      return [] as unknown as CSVArrayRecord<Header>;
    }
    if (
      this.#emptyRecordTemplate === undefined ||
      this.#emptyRecordTemplate.length !== this.#headerLength
    ) {
      this.#emptyRecordTemplate = new Array(this.#headerLength).fill("");
    }
    return this.#emptyRecordTemplate.slice() as unknown as CSVArrayRecord<Header>;
  }

  *#maybeYieldHeader(): IterableIterator<CSVArrayRecord<Header>> {
    if (
      this.#includeHeader &&
      this.#header !== undefined &&
      !this.#headerIncluded
    ) {
      this.#headerIncluded = true;
      yield (
        this.#header as unknown as string[]
      ).slice() as unknown as CSVArrayRecord<Header>;
    }
  }
}
