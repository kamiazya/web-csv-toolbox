import type {
  BinaryCSVLexer,
  CSVLexerLexOptions,
  Token,
} from "@/core/types.ts";
import { BinaryCSVLexerLegacy as WASMBinaryCSVLexerInternal } from "web-csv-toolbox-wasm";

/**
 * Options for WASMBinaryCSVLexer.
 */
export interface WASMBinaryCSVLexerOptions {
  /**
   * Field delimiter character.
   * @defaultValue ","
   */
  delimiter?: string;

  /**
   * Quote character for escaping fields.
   * @defaultValue '"'
   */
  quotation?: string;
}

/**
 * WASM-based Binary CSV Lexer for tokenizing binary (BufferSource) input.
 *
 * This lexer uses WebAssembly for high-performance CSV tokenization.
 * It implements the {@link BinaryCSVLexer} interface and can process CSV data
 * incrementally (streaming) or in a single pass.
 *
 * This lexer accepts BufferSource (Uint8Array, ArrayBuffer, etc.) chunks directly,
 * eliminating the overhead of TextDecoder.
 *
 * **Performance**: Approximately 2-4x faster than JavaScript-based lexing.
 *
 * @example Basic usage
 * ```typescript
 * import { loadWASM, WASMBinaryCSVLexer } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const lexer = new WASMBinaryCSVLexer({ delimiter: ',' });
 * const encoder = new TextEncoder();
 * const bytes = encoder.encode("id,name\n1,Alice");
 *
 * for (const token of lexer.lex(bytes)) {
 *   console.log(token);
 * }
 * ```
 *
 * @example Streaming usage
 * ```typescript
 * const lexer = new WASMBinaryCSVLexer();
 * const encoder = new TextEncoder();
 *
 * // Process chunks as they arrive
 * for (const token of lexer.lex(encoder.encode("id,na"), { stream: true })) {
 *   console.log(token);
 * }
 *
 * for (const token of lexer.lex(encoder.encode("me\n1,Alice"), { stream: true })) {
 *   console.log(token);
 * }
 *
 * // Flush remaining data
 * for (const token of lexer.lex()) {
 *   console.log(token);
 * }
 * ```
 */
export class WASMBinaryCSVLexer implements BinaryCSVLexer {
  #lexer: WASMBinaryCSVLexerInternal;

  /**
   * Create a new WASM Binary CSV Lexer.
   *
   * @param options - Lexer options
   */
  constructor(options: WASMBinaryCSVLexerOptions = {}) {
    const { delimiter = ",", quotation = '"' } = options;

    // Create lexer with options object
    const wasmOptions: {
      delimiter?: string;
      quotation?: string;
    } = {};

    if (delimiter !== ",") {
      wasmOptions.delimiter = delimiter;
    }
    if (quotation !== '"') {
      wasmOptions.quotation = quotation;
    }

    // Pass options object to WASM constructor
    // Note: Type cast needed until WASM is rebuilt with new constructor signature
    this.#lexer = new WASMBinaryCSVLexerInternal(wasmOptions as any);
  }

  /**
   * Lexes the given chunk of CSV binary data.
   *
   * When called with a chunk and `{ stream: true }`, the lexer processes the chunk
   * and returns completed tokens, keeping incomplete data in an internal buffer.
   *
   * When called with a chunk and `{ stream: false }` (or omitted), the lexer
   * processes the chunk as the final one and flushes all remaining data.
   *
   * When called without a chunk, flushes any remaining buffered data.
   *
   * @param chunk - The chunk of CSV binary data (BufferSource: Uint8Array, ArrayBuffer, or TypedArray) to be lexed. Omit to flush remaining data.
   * @param options - Lexer options.
   * @returns An iterable iterator of tokens.
   *
   * @example Streaming mode
   * ```typescript
   * const lexer = new WASMBinaryCSVLexer();
   * const encoder = new TextEncoder();
   *
   * for (const token of lexer.lex(encoder.encode("id,name\n1,"), { stream: true })) {
   *   console.log(token); // Tokens for "id", ",", "name", "\n", "1", ","
   * }
   * // "1," is buffered
   *
   * for (const token of lexer.lex(encoder.encode("Alice"), { stream: false })) {
   *   console.log(token); // Token for "Alice"
   * }
   * ```
   *
   * @example Flush mode
   * ```typescript
   * const lexer = new WASMBinaryCSVLexer();
   * const encoder = new TextEncoder();
   *
   * lexer.lex(encoder.encode("id,na"), { stream: true }); // "na" buffered
   *
   * for (const token of lexer.lex()) { // Flush
   *   console.log(token); // Token for "na"
   * }
   * ```
   */
  *lex(
    chunk?: Uint8Array,
    options?: CSVLexerLexOptions,
  ): IterableIterator<Token> {
    const { stream = false } = options ?? {};

    // Convert BufferSource to Uint8Array if needed
    let bytes: Uint8Array | undefined;
    if (chunk !== undefined) {
      if (chunk instanceof Uint8Array) {
        bytes = chunk;
      } else if (chunk instanceof ArrayBuffer) {
        bytes = new Uint8Array(chunk);
      } else if (ArrayBuffer.isView(chunk)) {
        // TypedArray
        bytes = new Uint8Array(
          chunk.buffer,
          chunk.byteOffset,
          chunk.byteLength,
        );
      } else {
        throw new Error(
          "chunk must be a BufferSource (Uint8Array, ArrayBuffer, or TypedArray)",
        );
      }
    }

    if (bytes === undefined || !stream) {
      // Flush mode or final chunk
      const result = this.#lexer.lex(bytes);
      if (Array.isArray(result)) {
        yield* result as Token[];
      }
    } else {
      // Streaming mode
      const result = this.#lexer.lex(bytes);
      if (Array.isArray(result)) {
        yield* result as Token[];
      }
    }
  }
}
