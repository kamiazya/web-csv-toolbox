import type {
  CSVArrayRecord,
  CSVArrayRecordAssembler,
  CSVObjectRecord,
  CSVObjectRecordAssembler,
  CSVRecordAssemblerAssembleOptions,
  Token,
} from "@/core/types.ts";
import { CSVRecordAssemblerLegacy as WASMCSVRecordAssemblerInternal } from "web-csv-toolbox-wasm";

/**
 * Options for WASMCSVRecordAssembler.
 *
 * @template Header - Array of header field names
 */
export interface WASMCSVRecordAssemblerOptions<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  /**
   * Custom header names. If not provided, the first record will be used as headers.
   */
  header?: Header;

  /**
   * Maximum number of fields per record.
   * @defaultValue 100000
   */
  maxFieldCount?: number;

  /**
   * Output format: "object" or "array".
   * @defaultValue "object"
   */
  outputFormat?: "object" | "array";
}

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

  /**
   * Create a new WASM CSV Object Record Assembler.
   *
   * @param options - Assembler options
   */
  constructor(options: WASMCSVRecordAssemblerOptions<Header> = {}) {
    const { header, maxFieldCount = 100000 } = options;

    // Create assembler with options object
    const wasmOptions: {
      header?: readonly string[];
      maxFieldCount?: number;
      outputFormat: "object";
    } = {
      outputFormat: "object",
    };

    if (header) {
      wasmOptions.header = header;
    }
    if (maxFieldCount !== 100000) {
      wasmOptions.maxFieldCount = maxFieldCount;
    }

    // Pass options object to WASM constructor
    // Note: Type cast needed until WASM is rebuilt with new constructor signature
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
      const result = this.#assembler.assemble(tokens);
      if (Array.isArray(result)) {
        yield* result as CSVObjectRecord<Header>[];
      }
    } else {
      // Streaming mode
      const result = this.#assembler.assemble(tokens);
      if (Array.isArray(result)) {
        yield* result as CSVObjectRecord<Header>[];
      }
    }
  }
}

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

  /**
   * Create a new WASM CSV Array Record Assembler.
   *
   * @param options - Assembler options
   */
  constructor(options: WASMCSVRecordAssemblerOptions<Header> = {}) {
    const { header, maxFieldCount = 100000 } = options;

    // Create assembler with options object
    const wasmOptions: {
      header?: readonly string[];
      maxFieldCount?: number;
      outputFormat: "array";
    } = {
      outputFormat: "array",
    };

    if (header) {
      wasmOptions.header = header;
    }
    if (maxFieldCount !== 100000) {
      wasmOptions.maxFieldCount = maxFieldCount;
    }

    // Pass options object to WASM constructor
    // Note: Type cast needed until WASM is rebuilt with new constructor signature
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
      const result = this.#assembler.assemble(tokens);
      if (Array.isArray(result)) {
        yield* result as CSVArrayRecord<Header>[];
      }
    } else {
      // Streaming mode
      const result = this.#assembler.assemble(tokens);
      if (Array.isArray(result)) {
        yield* result as CSVArrayRecord<Header>[];
      }
    }
  }
}
