/**
 * WASM-accelerated Binary CSV Lexer
 *
 * Implements BinaryCSVLexer interface using WASM-based
 * CSVSeparatorIndexer for high-performance CSV tokenization.
 *
 * @example
 * ```ts
 * import { loadWASMSync, WASMIndexerBackend } from 'web-csv-toolbox';
 *
 * // Initialize WASM first
 * loadWASMSync();
 *
 * // Create and initialize backend
 * const backend = new WASMIndexerBackend(44); // comma delimiter
 * await backend.initialize();
 *
 * const lexer = new WASMBinaryCSVLexer({ backend });
 *
 * // Stream processing
 * for (const chunk of chunks) {
 *   for (const token of lexer.lex(chunk, { stream: true })) {
 *     assembler.assemble(token);
 *   }
 * }
 *
 * // Flush remaining data
 * for (const token of lexer.lex()) {
 *   assembler.assemble(token);
 * }
 * ```
 */

import type {
  BinaryCSVLexer,
  CSVLexerLexOptions,
  Token,
} from "@/core/types.ts";
import type { CSVIndexerBackendSync } from "@/parser/indexer/CSVSeparatorIndexer.ts";
import { CSVSeparatorIndexer } from "@/parser/indexer/CSVSeparatorIndexer.ts";
import {
  type SeparatorsToTokensState,
  separatorsToTokensGenerator,
} from "@/parser/utils/separatorsToTokens.ts";
import { hasBOM } from "@/utils/binary/bom.ts";

/**
 * Configuration for WASMBinaryCSVLexer
 */
export interface WASMBinaryCSVLexerConfig {
  /**
   * The backend to use for WASM computation.
   * Must be initialized before calling lex().
   */
  backend: CSVIndexerBackendSync;

  /**
   * The field delimiter character used in the CSV.
   * @default ","
   */
  delimiter?: string;

  /**
   * The quotation character used for quoting fields.
   * Note: The WASM backend currently only supports the default '"' character
   * for quote-aware scanning. This option affects only the post-processing
   * of field values (unquoting and unescaping).
   * @default '"'
   */
  quotation?: string;

  /**
   * Whether to include the BOM in the output.
   * If true, the BOM will NOT be stripped from the input.
   * @default false
   */
  ignoreBOM?: boolean;
}

/**
 * WASM-accelerated implementation of BinaryCSVLexer.
 *
 * Uses CSVSeparatorIndexer to find field/record separators using WASM SIMD,
 * then generates tokens using separatorsToTokensGenerator.
 */
export class WASMBinaryCSVLexer implements BinaryCSVLexer {
  private readonly indexer: CSVSeparatorIndexer;
  private readonly delimiter: string;
  private readonly quotation: string;
  private readonly decoder: TextDecoder;
  private readonly ignoreBOM: boolean;

  // Token generation state (persisted across chunks)
  private tokenState: SeparatorsToTokensState;
  private isFirstChunk = true;

  // Keep track of accumulated data for token generation
  // This matches the indexer's combined buffer (leftover + current chunk)
  private accumulatedData: Uint8Array = new Uint8Array(0);

  constructor(config: WASMBinaryCSVLexerConfig) {
    this.indexer = new CSVSeparatorIndexer(config.backend);
    this.delimiter = config.delimiter ?? ",";
    this.quotation = config.quotation ?? '"';
    this.ignoreBOM = config.ignoreBOM ?? false;
    this.decoder = new TextDecoder("utf-8", { ignoreBOM: this.ignoreBOM });

    // Initialize token state
    this.tokenState = {
      rowNumber: 1,
      line: 1,
      column: 1,
      offset: 0,
    };
  }

  /**
   * Lexes the given chunk of CSV binary data.
   *
   * @param chunk - The chunk of CSV binary data (Uint8Array) to be lexed.
   *                Omit to flush remaining data.
   * @param options - Lexer options.
   * @returns An iterable iterator of tokens.
   */
  *lex(
    chunk?: Uint8Array,
    options?: CSVLexerLexOptions,
  ): IterableIterator<Token> {
    const stream = options?.stream ?? false;

    if (chunk === undefined) {
      // Flush mode: process remaining data
      yield* this.flush();
      return;
    }

    // Handle BOM on first chunk (skip if ignoreBOM is true)
    let processedChunk = chunk;
    if (this.isFirstChunk) {
      if (!this.ignoreBOM && hasBOM(chunk)) {
        processedChunk = chunk.subarray(3); // Use subarray for zero-copy
      }
      this.isFirstChunk = false;
    }

    // Skip empty chunks
    if (processedChunk.length === 0) {
      return;
    }

    // Index separators using WASM
    // The indexer internally combines its leftover with the new chunk
    const indexResult = this.indexer.index(processedChunk, { stream });

    if (indexResult.sepCount === 0) {
      // No separators found, nothing to yield yet
      // Update accumulated data for potential future flush
      this.accumulatedData = this.indexer.getLeftover();
      return;
    }

    // The indexer processed combined data (its leftover + processedChunk).
    // processedBytes tells us how much of that combined data was consumed.
    // The separators reference offsets in the combined data.

    // Build the combined data that the indexer worked with
    const currentLeftover = this.indexer.getLeftover();
    const previousLeftover = this.accumulatedData;
    let combinedData: Uint8Array;

    if (previousLeftover.length > 0) {
      combinedData = new Uint8Array(
        previousLeftover.length + processedChunk.length,
      );
      combinedData.set(previousLeftover, 0);
      combinedData.set(processedChunk, previousLeftover.length);
    } else {
      combinedData = processedChunk;
    }

    // Use subarray (zero-copy view) instead of slice for better performance
    const dataForTokens = combinedData.subarray(0, indexResult.processedBytes);

    // Update accumulated data to current leftover for next iteration
    this.accumulatedData = currentLeftover;

    // Generate tokens from separators
    yield* this.generateTokens(
      indexResult.separators,
      indexResult.sepCount,
      dataForTokens,
    );
  }

  /**
   * Generate tokens from separators and update state.
   */
  private *generateTokens(
    separators: Uint32Array,
    sepCount: number,
    data: Uint8Array,
  ): Generator<Token, void, void> {
    const generator = separatorsToTokensGenerator(separators, sepCount, data, {
      rowNumber: this.tokenState.rowNumber,
      startLine: this.tokenState.line,
      startColumn: this.tokenState.column,
      startOffset: this.tokenState.offset,
      decoder: this.decoder,
      delimiter: this.delimiter,
      quotation: this.quotation,
    });

    // Yield tokens one by one
    let result = generator.next();
    while (!result.done) {
      yield result.value;
      result = generator.next();
    }

    // Update state from generator return value
    if (result.value) {
      this.tokenState = result.value;
    }
  }

  /**
   * Flush remaining data and yield final tokens.
   */
  private *flush(): Generator<Token, void, void> {
    // Get leftover data BEFORE flushing (indexer clears it after flush)
    const leftoverData = this.indexer.getLeftover();

    // Flush the indexer to get remaining separators
    const indexResult = this.indexer.index();

    if (indexResult.sepCount === 0 && leftoverData.length === 0) {
      // Nothing to flush
      return;
    }

    // Use subarray (zero-copy view) instead of slice for better performance
    const dataForTokens = leftoverData.subarray(0, indexResult.processedBytes);

    // Generate tokens from remaining separators
    yield* this.generateTokens(
      indexResult.separators,
      indexResult.sepCount,
      dataForTokens,
    );

    // Clear accumulated data
    this.accumulatedData = new Uint8Array(0);
  }

  /**
   * Reset the lexer state.
   *
   * Call this when starting to process a new CSV file.
   */
  reset(): void {
    this.indexer.reset();
    this.isFirstChunk = true;
    this.accumulatedData = new Uint8Array(0);
    this.tokenState = {
      rowNumber: 1,
      line: 1,
      column: 1,
      offset: 0,
    };
  }
}
