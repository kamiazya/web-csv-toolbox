import { BinaryCSVLexerLegacy as WASMBinaryCSVLexerInternal } from "web-csv-toolbox-wasm";
import { Field, FieldDelimiter, RecordDelimiter } from "@/core/constants.ts";
import type {
  BinaryCSVLexer,
  CSVLexerLexOptions,
  Token,
} from "@/core/types.ts";

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

    const bytes = chunk;

    if (bytes === undefined || !stream) {
      // Flush mode or final chunk
      // Collect all tokens from both chunk processing and flush
      const allTokens: any[] = [];

      if (bytes !== undefined) {
        // Process the final chunk
        const result = this.#lexer.lex(bytes);
        if (Array.isArray(result)) {
          allTokens.push(...result);
        }
      }

      // Always flush remaining data when not in streaming mode
      const flushResult = this.#lexer.lex();
      if (Array.isArray(flushResult)) {
        allTokens.push(...flushResult);
      }

      // Apply JS-compatible filtering to ALL tokens together, with isFlush=true
      const filtered = this.#filterTokensForJSCompatibility(allTokens, true);
      yield* this.#normalizeTokens(filtered);
    } else {
      // Streaming mode
      const result = this.#lexer.lex(bytes);
      if (Array.isArray(result)) {
        // Apply JS-compatible filtering
        const filtered = this.#filterTokensForJSCompatibility(result, false);
        yield* this.#normalizeTokens(filtered);
      }
    }
  }

  /**
   * Filter WASM tokens to match JS lexer behavior.
   *
   * Fixes:
   * 1. Empty field handling - JS doesn't emit empty field tokens before delimiters
   * 2. Trailing newline handling - JS strips trailing record delimiter
   *
   * @param tokens - WASM tokens
   * @param isFlush - Whether this is flush mode (final chunk)
   * @returns Filtered tokens
   */
  #filterTokensForJSCompatibility(tokens: any[], isFlush: boolean): any[] {
    const filtered: any[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const nextToken = tokens[i + 1];

      // Skip empty field tokens that appear before delimiters (to match JS behavior)
      // JS lexer doesn't emit field tokens for empty fields
      if (
        token.type === "field" &&
        token.value === "" &&
        nextToken &&
        (nextToken.type === "field-delimiter" || nextToken.type === "record-delimiter")
      ) {
        continue;
      }

      // In flush mode, strip trailing record delimiter (to match JS behavior)
      // JS lexer strips the last CRLF or LF
      if (
        isFlush &&
        i === tokens.length - 1 &&
        token.type === "record-delimiter"
      ) {
        continue;
      }

      filtered.push(token);
    }

    return filtered;
  }

  /**
   * Normalize WASM tokens to match JS token format.
   * Converts string token types to Symbol types for compatibility.
   *
   * @param tokens - WASM tokens with string types
   * @returns Normalized tokens with Symbol types
   */
  *#normalizeTokens(tokens: any[]): IterableIterator<Token> {
    for (const token of tokens) {
      // Convert string type to Symbol type
      let type: symbol;
      switch (token.type) {
        case "field":
          type = Field;
          break;
        case "field-delimiter":
          type = FieldDelimiter;
          break;
        case "record-delimiter":
          type = RecordDelimiter;
          break;
        default:
          // Fallback: try to use the string as-is (should not happen)
          type = Symbol.for(`web-csv-toolbox.${token.type}`);
      }

      yield {
        type,
        value: token.value,
        location: token.location,
      } as Token;
    }
  }
}
