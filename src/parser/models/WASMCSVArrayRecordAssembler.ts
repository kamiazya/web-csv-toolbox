import { CSVRecordAssemblerLegacy as WASMCSVRecordAssemblerInternal } from "web-csv-toolbox-wasm";
import { DEFAULT_ASSEMBLER_MAX_FIELD_COUNT } from "@/core/constants.ts";
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
import type { WASMArrayAssemblerOptions } from "./wasm-internal-types.ts";

/**
 * WASM-based CSV Record Assembler for array output format.
 *
 * This assembler uses WebAssembly for high-performance record assembly from tokens.
 * It implements the {@link CSVArrayRecordAssembler} interface.
 *
 * **Performance**: Approximately 2-4x faster than JavaScript-based assembly.
 *
 * @template Header - Array of header field names
 *
 * @example Basic usage
 * ```typescript
 * import { loadWASM, WASMBinaryCSVLexer, WASMCSVArrayRecordAssembler } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const lexer = new WASMBinaryCSVLexer();
 * const assembler = new WASMCSVArrayRecordAssembler();
 *
 * const encoder = new TextEncoder();
 * const bytes = encoder.encode("id,name\n1,Alice\n2,Bob");
 *
 * const tokens = [...lexer.lex(bytes)];
 * for (const record of assembler.assemble(tokens)) {
 *   console.log(record); // ['1', 'Alice'], ['2', 'Bob']
 * }
 * ```
 */
export class WASMCSVArrayRecordAssembler<
  Header extends ReadonlyArray<string> = readonly string[],
> implements CSVArrayRecordAssembler<Header>
{
  #assembler: WASMCSVRecordAssemblerInternal;
  #header: Header | undefined;
  #columnCountStrategy: ColumnCountStrategy;
  #skipEmptyLines: boolean;
  #includeHeader: boolean;
  #headerIncluded = false;
  #signal?: AbortSignal;
  #source?: string;
  #maxFieldCount: number;

  /**
   * Create a new WASM CSV Array Record Assembler.
   *
   * @param options - Assembler options
   */
  constructor(options: CSVRecordAssemblerCommonOptions<Header> = {}) {
    const {
      header,
      maxFieldCount = DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
      columnCountStrategy = "keep",
      skipEmptyLines = false,
      includeHeader = false,
      signal,
      source,
    } = options;

    this.#includeHeader = includeHeader;

    // Validate includeHeader option - requires explicit header for WASM
    if (includeHeader && header === undefined) {
      throw new Error(
        "includeHeader: true requires explicit header option for WASM assembler. " +
          "WASM cannot expose inferred headers. Provide header explicitly or use JS assembler.",
      );
    }

    // Validate headerless mode (header: [])
    if (
      header !== undefined &&
      Array.isArray(header) &&
      header.length === 0
    ) {
      // Headerless mode: only 'keep' strategy is allowed
      if (
        columnCountStrategy !== undefined &&
        columnCountStrategy !== "keep"
      ) {
        throw new Error(
          `Headerless mode (header: []) only supports columnCountStrategy: 'keep'. ` +
            `Got '${columnCountStrategy}'. ` +
            `For other strategies, provide a non-empty header.`,
        );
      }
    }

    // Validate and set columnCountStrategy
    this.#columnCountStrategy = columnCountStrategy;
    if (this.#columnCountStrategy !== "keep" && header === undefined) {
      throw new Error(
        `columnCountStrategy '${this.#columnCountStrategy}' requires header option. ` +
          `Use 'keep' or omit columnCountStrategy for headerless CSV.`,
      );
    }

    // Validate maxFieldCount
    validateMaxFieldCount(maxFieldCount);

    this.#maxFieldCount = maxFieldCount;
    this.#skipEmptyLines = skipEmptyLines;
    this.#signal = signal;
    this.#source = source;

    if (header !== undefined && Array.isArray(header)) {
      this.#validateAndSetHeader(header as Header);
    }

    // Create assembler with options object for WASM
    const wasmOptions: WASMArrayAssemblerOptions = {
      outputFormat: "array",
    };

    if (header) {
      wasmOptions.header = header;
    }
    if (maxFieldCount !== DEFAULT_ASSEMBLER_MAX_FIELD_COUNT) {
      wasmOptions.maxFieldCount = maxFieldCount;
    }

    // Pass options object to WASM constructor
    this.#assembler = new WASMCSVRecordAssemblerInternal(wasmOptions as any);
  }

  /**
   * Assembles tokens into CSV records in array format.
   *
   * @param input - A token or iterable of tokens to be assembled. Omit to flush remaining data.
   * @param options - Assembler options.
   * @returns An iterable iterator of CSV records as arrays/tuples.
   */
  *assemble(
    input?: Token | Iterable<Token>,
    options?: CSVRecordAssemblerAssembleOptions,
  ): IterableIterator<CSVArrayRecord<Header>> {
    const { stream = false } = options ?? {};

    // Check for abort signal
    this.#signal?.throwIfAborted();

    // Yield header if includeHeader is enabled (before processing any records)
    yield* this.#maybeYieldHeader();

    // Convert input to array of tokens
    let tokens: Token[] | undefined;
    if (input !== undefined) {
      if (Symbol.iterator in input) {
        tokens = Array.from(input as Iterable<Token>);
      } else {
        tokens = [input as Token];
      }
    }

    if (tokens === undefined || !stream) {
      // Flush mode or final tokens
      if (tokens !== undefined) {
        // Process the tokens
        const result = this.#assembler.assemble(tokens);
        if (Array.isArray(result)) {
          yield* this.#processRecords(result as CSVArrayRecord<Header>[]);
        }
      }

      // Always flush in non-streaming mode
      const flushResult = this.#assembler.assemble();
      if (Array.isArray(flushResult)) {
        yield* this.#processRecords(flushResult as CSVArrayRecord<Header>[]);
      }
    } else {
      // Streaming mode
      const result = this.#assembler.assemble(tokens);
      if (Array.isArray(result)) {
        yield* this.#processRecords(result as CSVArrayRecord<Header>[]);
      }
    }
  }

  /**
   * Validate and set header with proper error handling.
   */
  #validateAndSetHeader(header: Header): void {
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

  /**
   * Process records with columnCountStrategy and skipEmptyLines options.
   */
  *#processRecords(
    records: CSVArrayRecord<Header>[],
  ): IterableIterator<CSVArrayRecord<Header>> {
    for (const record of records) {
      // Check for abort signal
      this.#signal?.throwIfAborted();

      // Handle empty records
      if (this.#isEmptyRecord(record)) {
        if (this.#skipEmptyLines) {
          continue;
        }
        // For empty lines, generate empty record filled with empty strings
        // to match JS behavior (JS fills empty records to header length)
        if (this.#header && this.#header.length > 0) {
          yield new Array(this.#header.length).fill(
            "",
          ) as unknown as CSVArrayRecord<Header>;
          continue;
        }
      }

      // Apply columnCountStrategy
      yield this.#applyColumnCountStrategy(record);
    }
  }

  /**
   * Check if a record represents a truly empty line (all values are undefined or length is 0).
   * A row with empty fields like "," has values of "" which is actual data,
   * not an empty line. Only rows with all undefined values (from WASM
   * returning no field data at all) are considered truly empty.
   */
  #isEmptyRecord(record: CSVArrayRecord<Header>): boolean {
    // Only consider it empty if length is 0 OR all values are undefined (not empty string)
    // Empty string "" means the field existed but was empty, which is actual data
    return record.length === 0 || record.every((v) => v === undefined);
  }

  /**
   * Apply column count strategy to a record.
   */
  #applyColumnCountStrategy(
    record: CSVArrayRecord<Header>,
  ): CSVArrayRecord<Header> {
    if (!this.#header || this.#header.length === 0) {
      // Headerless mode: return as-is
      return record;
    }

    const headerLength = this.#header.length;
    const rowLength = record.length;

    switch (this.#columnCountStrategy) {
      case "keep":
        // Return row as-is
        return record;

      case "pad":
        // Pad short rows with undefined, truncate long rows
        if (rowLength < headerLength) {
          const padded = [...record];
          while (padded.length < headerLength) {
            padded.push(undefined as unknown as string);
          }
          return padded as unknown as CSVArrayRecord<Header>;
        }
        if (rowLength > headerLength) {
          return record.slice(0, headerLength) as unknown as CSVArrayRecord<Header>;
        }
        return record;

      case "strict":
        // Throw error if length doesn't match
        if (rowLength !== headerLength) {
          throw new ParseError(
            `Expected ${headerLength} columns, got ${rowLength}${
              this.#source ? ` in ${JSON.stringify(this.#source)}` : ""
            }`,
            {
              source: this.#source,
            },
          );
        }
        return record;

      case "truncate":
        // Truncate long rows, keep short rows as-is
        if (rowLength > headerLength) {
          return record.slice(0, headerLength) as unknown as CSVArrayRecord<Header>;
        }
        return record;

      default:
        // Should never reach here due to validation
        return record;
    }
  }

}
