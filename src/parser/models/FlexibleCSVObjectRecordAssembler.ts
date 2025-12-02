import {
  DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  Delimiter,
} from "@/core/constants.ts";
import { ParseError } from "@/core/errors.ts";
import type {
  AnyToken,
  ColumnCountStrategy,
  CSVObjectRecord,
  CSVRecordAssemblerAssembleOptions,
  CSVRecordAssemblerCommonOptions,
} from "@/core/types.ts";
import { ReusableArrayPool } from "@/utils/memory/ReusableArrayPool.ts";

/**
 * Flexible CSV Object Record Assembler implementation.
 *
 * An optimized assembler that works with unified field tokens.
 * No switch statement needed - simply processes each field and checks
 * the `delimiter` property to determine when a record is complete.
 *
 * @remarks
 * This implementation provides better performance by eliminating
 * the token type switch statement and reducing token iteration count by 50%.
 */
export class FlexibleCSVObjectRecordAssembler<
  Header extends ReadonlyArray<string>,
> {
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #signal?: AbortSignal | undefined;
  #maxFieldCount: number;
  #skipEmptyLines: boolean;
  #currentRowNumber?: number | undefined;
  #source?: string | undefined;
  #columnCountStrategy: ColumnCountStrategy;
  #rowLength = 0;
  #rowPool = new ReusableArrayPool<string[]>();

  // Optimization: Pre-bound strategy function (avoids switch per record)
  #assembleRecordFn:
    | ((row: string[], rowLength: number) => CSVObjectRecord<Header>)
    | undefined;
  // Optimization: Pre-computed valid header indices (avoids if check per field)
  #validHeaderIndices: number[] = [];
  // Optimization: Pre-created header keys (avoids header lookup per record)
  #headerKeys: string[] = [];
  // Optimization: Track if row has content (avoids some() call per record)
  #hasContent = false;

  constructor(options: CSVRecordAssemblerCommonOptions<Header> = {}) {
    // Validate and set columnCountStrategy
    this.#columnCountStrategy = options.columnCountStrategy ?? "fill";

    // 'sparse' is not allowed in object format because object format requires all keys to have string values
    if (this.#columnCountStrategy === "sparse") {
      throw new Error(
        "columnCountStrategy 'sparse' is not allowed for object format. " +
          "'sparse' fills missing fields with undefined, which is not compatible with object format. " +
          "Use 'fill' (fills with empty string) or outputFormat: 'array' for sparse data.",
      );
    }

    if (
      this.#columnCountStrategy === "keep" ||
      this.#columnCountStrategy === "truncate"
    ) {
      throw new Error(
        `columnCountStrategy '${this.#columnCountStrategy}' is not allowed for object format. ` +
          "Use 'fill' (default) or 'strict' for object output.",
      );
    }
    if (this.#columnCountStrategy !== "fill" && options.header === undefined) {
      throw new Error(
        `columnCountStrategy '${this.#columnCountStrategy}' requires header option. ` +
          `Use 'fill' or omit columnCountStrategy for headerless CSV.`,
      );
    }

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
    input?: AnyToken | Iterable<AnyToken>,
    options?: CSVRecordAssemblerAssembleOptions,
  ): IterableIterator<CSVObjectRecord<Header>> {
    const stream = options?.stream ?? false;

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
  *#processToken(token: AnyToken): IterableIterator<CSVObjectRecord<Header>> {
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

    if (token.delimiter === Delimiter.Field) {
      this.#fieldIndex++;
      this.#checkFieldCount();
      this.#rowLength = Math.max(this.#rowLength, this.#fieldIndex + 1);
      return;
    }

    const rowLength = this.#rowLength || this.#fieldIndex + 1 || 0;
    const hadContent = this.#hasContent;
    const completedRow = this.#takeRow(rowLength);

    if (this.#header === undefined) {
      this.#setHeader(completedRow as unknown as Header);
      // Header takes ownership of completedRow; do not release.
      return;
    }

    if (hadContent) {
      yield this.#assembleRecord(completedRow, rowLength);
    } else if (!this.#skipEmptyLines) {
      this.#releaseRow(completedRow);
      yield this.#createEmptyRecord();
    } else {
      this.#releaseRow(completedRow);
    }
    this.#hasContent = false;
  }

  *#flush(): IterableIterator<CSVObjectRecord<Header>> {
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
    if (this.#header.length === 0) {
      throw new ParseError(
        "Headerless mode (header: []) is not supported for object format. " +
          "Use array format (outputFormat: 'array') for headerless CSV, " +
          "or provide a non-empty header for object format.",
        {
          source: this.#source,
        },
      );
    }
    if (new Set(this.#header).size !== this.#header.length) {
      throw new ParseError("The header must not contain duplicate fields.", {
        source: this.#source,
      });
    }

    // Optimization: Pre-compute valid header indices (non-empty headers)
    this.#validHeaderIndices = [];
    this.#headerKeys = [];
    for (let i = 0; i < header.length; i++) {
      const key = header[i];
      if (key) {
        this.#validHeaderIndices.push(i);
        this.#headerKeys.push(key);
      }
    }

    // Optimization: Pre-bind strategy function based on columnCountStrategy
    switch (this.#columnCountStrategy) {
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
  }

  /**
   * Assembles a record in object format.
   * Uses pre-bound strategy function for optimal performance.
   *
   * @remarks
   * SAFETY: Object.create(null) creates a prototype-less object, which:
   * - Is safe from prototype pollution attacks
   * - Correctly stores all header names including "__proto__" as regular properties
   * - Is faster than Object.fromEntries() (~3.6x speedup)
   * See CSVRecordAssembler.prototype-safety.test.ts for details.
   */
  #assembleRecord(row: string[], rowLength: number): CSVObjectRecord<Header> {
    if (!this.#header || !this.#assembleRecordFn) {
      this.#releaseRow(row);
      // Headerless: return empty object (shouldn't happen in normal flow)
      return Object.create(null) as CSVObjectRecord<Header>;
    }
    const record = this.#assembleRecordFn(row, rowLength);
    this.#releaseRow(row);
    return record;
  }

  /**
   * Optimized "fill" strategy: map all header keys, fill missing values with empty string.
   * Uses Object.create(null) for faster object creation and proper "__proto__" handling.
   */
  #assembleRecordFill = (
    row: string[],
    _rowLength: number,
  ): CSVObjectRecord<Header> => {
    const indices = this.#validHeaderIndices;
    const len = indices.length;
    const keys = this.#headerKeys;

    // Object.create(null) is ~3.6x faster than Object.fromEntries
    // and correctly handles "__proto__" as a regular property
    const obj = Object.create(null) as CSVObjectRecord<Header>;
    for (let j = 0; j < len; j++) {
      (obj as Record<string, string>)[keys[j]!] = row[indices[j]!] ?? "";
    }

    return obj;
  };

  /**
   * Optimized "strict" strategy: throw error if column count doesn't match.
   * Uses Object.create(null) for faster object creation and proper "__proto__" handling.
   */
  #assembleRecordStrict = (
    row: string[],
    rowLength: number,
  ): CSVObjectRecord<Header> => {
    const headerLength = this.#header!.length;

    if (rowLength !== headerLength) {
      this.#releaseRow(row);
      throw new ParseError(
        `Expected ${headerLength} columns, got ${rowLength}${
          this.#currentRowNumber ? ` at row ${this.#currentRowNumber}` : ""
        }${this.#source ? ` in ${JSON.stringify(this.#source)}` : ""}`,
        {
          source: this.#source,
        },
      );
    }

    const indices = this.#validHeaderIndices;
    const len = indices.length;
    const keys = this.#headerKeys;

    const obj = Object.create(null) as CSVObjectRecord<Header>;
    for (let j = 0; j < len; j++) {
      (obj as Record<string, string>)[keys[j]!] = row[indices[j]!] ?? "";
    }

    return obj;
  };

  /**
   * Optimized "truncate" strategy: only include fields up to header length.
   * Uses Object.create(null) for faster object creation and proper "__proto__" handling.
   */
  #assembleRecordTruncate = (
    row: string[],
    _rowLength: number,
  ): CSVObjectRecord<Header> => {
    const indices = this.#validHeaderIndices;
    const len = indices.length;
    const keys = this.#headerKeys;

    const obj = Object.create(null) as CSVObjectRecord<Header>;
    for (let j = 0; j < len; j++) {
      (obj as Record<string, string>)[keys[j]!] = row[indices[j]!] ?? "";
    }

    return obj;
  };

  #takeRow(rowLength: number): string[] {
    const record = this.#row;
    record.length = rowLength;
    const capacityHint = Math.max(rowLength, this.#header?.length ?? 4);
    this.#row = this.#allocateRowBuffer(capacityHint);
    this.#resetRowBuilderState(true);
    return record;
  }

  #releaseRow(row: string[]): void {
    row.length = 0;
    this.#rowPool.release(row);
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
    const ensure = Math.max(capacityHint, 0);
    const buffer = this.#rowPool.take(() =>
      ensure > 0 ? new Array(ensure) : [],
    );
    if (ensure > 0 && buffer.length < ensure) {
      buffer.length = ensure;
    }
    buffer.length = 0;
    return buffer;
  }

  #createEmptyRecord(): CSVObjectRecord<Header> {
    const header = this.#header;
    const obj = Object.create(null) as CSVObjectRecord<Header>;
    if (!header) {
      return obj;
    }
    for (let i = 0; i < header.length; i++) {
      (obj as Record<string, string>)[header[i]!] = "";
    }
    return obj;
  }
}
