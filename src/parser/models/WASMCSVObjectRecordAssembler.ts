import { CSVRecordAssemblerLegacy as WASMCSVRecordAssemblerInternal } from "web-csv-toolbox-wasm";
import { DEFAULT_ASSEMBLER_MAX_FIELD_COUNT } from "@/core/constants.ts";
import { ParseError } from "@/core/errors.ts";
import type {
  ColumnCountStrategy,
  CSVObjectRecord,
  CSVObjectRecordAssembler,
  CSVRecordAssemblerAssembleOptions,
  CSVRecordAssemblerCommonOptions,
  Token,
} from "@/core/types.ts";
import { validateColumnCountStrategyForObject } from "@/parser/utils/validateColumnCountStrategyForObject.ts";
import { validateMaxFieldCount } from "@/parser/utils/validateMaxFieldCount.ts";
import type { WASMObjectAssemblerOptions } from "./wasm-internal-types.ts";

/**
 * WASM-based CSV Record Assembler for object output format.
 *
 * This assembler uses WebAssembly for high-performance record assembly from tokens.
 * It implements the {@link CSVObjectRecordAssembler} interface.
 *
 * **Performance**: Approximately 2-4x faster than JavaScript-based assembly.
 *
 * @template Header - Array of header field names
 *
 * @example Basic usage
 * ```typescript
 * import { loadWASM, WASMBinaryCSVLexer, WASMCSVObjectRecordAssembler } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const lexer = new WASMBinaryCSVLexer();
 * const assembler = new WASMCSVObjectRecordAssembler();
 *
 * const encoder = new TextEncoder();
 * const bytes = encoder.encode("id,name\n1,Alice\n2,Bob");
 *
 * const tokens = [...lexer.lex(bytes)];
 * for (const record of assembler.assemble(tokens)) {
 *   console.log(record); // { id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }
 * }
 * ```
 */
export class WASMCSVObjectRecordAssembler<
  Header extends ReadonlyArray<string> = readonly string[],
> implements CSVObjectRecordAssembler<Header>
{
  #assembler: WASMCSVRecordAssemblerInternal;
  #header: Header | undefined;
  #columnCountStrategy: ColumnCountStrategy;
  #skipEmptyLines: boolean;
  #signal?: AbortSignal;
  #source?: string;
  #maxFieldCount: number;

  /**
   * Create a new WASM CSV Object Record Assembler.
   *
   * @param options - Assembler options
   */
  constructor(options: CSVRecordAssemblerCommonOptions<Header> = {}) {
    const {
      header,
      maxFieldCount = DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
      columnCountStrategy = "pad",
      skipEmptyLines = false,
      signal,
      source,
    } = options;

    // Validate columnCountStrategy for object format
    validateColumnCountStrategyForObject(columnCountStrategy);
    this.#columnCountStrategy = columnCountStrategy;
    if (this.#columnCountStrategy !== "pad" && header === undefined) {
      throw new Error(
        `columnCountStrategy '${this.#columnCountStrategy}' requires header option. ` +
          `Use 'pad' or omit columnCountStrategy for headerless CSV.`,
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
    const wasmOptions: WASMObjectAssemblerOptions = {
      outputFormat: "object",
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
   * Assembles tokens into CSV records in object format.
   *
   * @param input - A token or iterable of tokens to be assembled. Omit to flush remaining data.
   * @param options - Assembler options.
   * @returns An iterable iterator of CSV records as objects.
   */
  *assemble(
    input?: Token | Iterable<Token>,
    options?: CSVRecordAssemblerAssembleOptions,
  ): IterableIterator<CSVObjectRecord<Header>> {
    const { stream = false } = options ?? {};

    // Check for abort signal
    this.#signal?.throwIfAborted();

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
          yield* this.#processRecords(result as CSVObjectRecord<Header>[]);
        }
      }

      // Always flush in non-streaming mode
      const flushResult = this.#assembler.assemble();
      if (Array.isArray(flushResult)) {
        yield* this.#processRecords(flushResult as CSVObjectRecord<Header>[]);
      }
    } else {
      // Streaming mode
      const result = this.#assembler.assemble(tokens);
      if (Array.isArray(result)) {
        yield* this.#processRecords(result as CSVObjectRecord<Header>[]);
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
  }

  /**
   * Process records with columnCountStrategy and skipEmptyLines options.
   */
  *#processRecords(
    records: CSVObjectRecord<Header>[],
  ): IterableIterator<CSVObjectRecord<Header>> {
    for (const record of records) {
      // Check for abort signal
      this.#signal?.throwIfAborted();

      // Infer header from first record if not explicitly set
      // (WASM infers header internally but doesn't expose it)
      if (!this.#header) {
        const keys = Object.keys(record);
        if (keys.length > 0) {
          this.#header = keys as unknown as Header;
        }
      }

      // Handle empty records
      if (this.#isEmptyRecord(record)) {
        if (this.#skipEmptyLines) {
          continue;
        }
        // For empty lines, generate empty record with all header keys set to ""
        // to match JS behavior
        if (this.#header && this.#header.length > 0) {
          yield Object.fromEntries(
            this.#header.map((key) => [key, ""]),
          ) as unknown as CSVObjectRecord<Header>;
          continue;
        }
      }

      // Apply columnCountStrategy
      yield this.#applyColumnCountStrategy(record);
    }
  }

  /**
   * Check if a record represents a truly empty line (all values are undefined).
   * A row with empty fields like "," has values of "" which is actual data,
   * not an empty line. Only rows with all undefined values (from WASM
   * returning no field data at all) are considered truly empty.
   */
  #isEmptyRecord(record: CSVObjectRecord<Header>): boolean {
    const values = Object.values(record);
    // Only consider it empty if ALL values are undefined (not empty string)
    // Empty string "" means the field existed but was empty, which is actual data
    return values.length === 0 || values.every((v) => v === undefined);
  }

  /**
   * Apply column count strategy to a record.
   */
  #applyColumnCountStrategy(
    record: CSVObjectRecord<Header>,
  ): CSVObjectRecord<Header> {
    if (!this.#header) {
      return record;
    }

    if (this.#columnCountStrategy === "strict") {
      // Count actual values (not undefined)
      const headerLength = this.#header.length;
      const actualValueCount = Object.values(record).filter(
        (v) => v !== undefined,
      ).length;
      if (actualValueCount !== headerLength) {
        throw new ParseError(
          `Expected ${headerLength} columns, got ${actualValueCount}${
            this.#source ? ` in ${JSON.stringify(this.#source)}` : ""
          }`,
          {
            source: this.#source,
          },
        );
      }
    }

    // For "truncate", "pad", and "keep" (which falls back to "pad")
    // WASM already handles these cases by mapping to header keys
    return record;
  }

}
