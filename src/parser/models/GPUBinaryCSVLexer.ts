/**
 * GPU-accelerated Binary CSV Lexer
 *
 * Implements AsyncBinaryCSVLexer interface using WebGPU-based
 * CSVSeparatorIndexer for high-performance CSV tokenization.
 *
 * @example
 * ```ts
 * const backend = new CSVSeparatorIndexingBackend();
 * await backend.initialize();
 *
 * const lexer = new GPUBinaryCSVLexer({ backend });
 *
 * // Stream processing
 * for await (const chunk of stream) {
 *   for await (const token of lexer.lex(chunk, { stream: true })) {
 *     assembler.assemble(token);
 *   }
 * }
 *
 * // Flush remaining data
 * for await (const token of lexer.lex()) {
 *   assembler.assemble(token);
 * }
 *
 * await backend.destroy();
 * ```
 */

import type {
  AsyncBinaryCSVLexer,
  CSVLexerLexOptions,
  Token,
} from "@/core/types.ts";
import {
  type SeparatorsToTokensState,
  separatorsToTokensGenerator,
} from "@/parser/webgpu/assembly/separatorsToTokens.ts";
import {
  CSVSeparatorIndexer,
  type CSVSeparatorIndexingBackendInterface,
} from "@/parser/webgpu/indexing/CSVSeparatorIndexer.ts";
import { stripBOM } from "@/parser/webgpu/utils/stripBOM.ts";

/**
 * Configuration for GPUBinaryCSVLexer
 */
export interface GPUBinaryCSVLexerConfig {
  /**
   * The backend to use for GPU computation.
   * Must be initialized before calling lex().
   */
  backend: CSVSeparatorIndexingBackendInterface;

  /**
   * The field delimiter character used in the CSV.
   * @default ","
   */
  delimiter?: string;
}

/**
 * GPU-accelerated implementation of AsyncBinaryCSVLexer.
 *
 * Uses CSVSeparatorIndexer to find field/record separators on GPU,
 * then generates tokens using separatorsToTokensGenerator.
 */
export class GPUBinaryCSVLexer implements AsyncBinaryCSVLexer {
  private readonly indexer: CSVSeparatorIndexer;
  private readonly delimiter: string;
  private readonly decoder: TextDecoder;

  // Token generation state (persisted across chunks)
  private tokenState: SeparatorsToTokensState;
  private isFirstChunk = true;

  // Keep track of accumulated data for token generation
  // This matches the indexer's combined buffer (leftover + current chunk)
  private accumulatedData: Uint8Array = new Uint8Array(0);

  constructor(config: GPUBinaryCSVLexerConfig) {
    this.indexer = new CSVSeparatorIndexer({ backend: config.backend });
    this.delimiter = config.delimiter ?? ",";
    this.decoder = new TextDecoder("utf-8");

    // Initialize token state
    this.tokenState = {
      rowNumber: 1,
      line: 1,
      column: 1,
      offset: 0,
    };
  }

  /**
   * Lexes the given chunk of CSV binary data asynchronously.
   *
   * @param chunk - The chunk of CSV binary data (Uint8Array) to be lexed.
   *                Omit to flush remaining data.
   * @param options - Lexer options.
   * @returns An async iterable iterator of tokens.
   */
  async *lex(
    chunk?: Uint8Array,
    options?: CSVLexerLexOptions,
  ): AsyncIterableIterator<Token> {
    const stream = options?.stream ?? false;

    if (chunk === undefined) {
      // Flush mode: process remaining data
      yield* this.flush();
      return;
    }

    // Handle BOM on first chunk
    let processedChunk = chunk;
    if (this.isFirstChunk) {
      processedChunk = stripBOM(chunk);
      this.isFirstChunk = false;
    }

    // Skip empty chunks
    if (processedChunk.length === 0) {
      return;
    }

    // Index separators using GPU
    // The indexer internally combines its leftover with the new chunk
    const indexResult = await this.indexer.index(processedChunk, { stream });

    if (indexResult.sepCount === 0) {
      // No separators found, nothing to yield yet
      // Update accumulated data for potential future flush
      this.accumulatedData = this.indexer.getLeftover();
      return;
    }

    // The indexer processed combined data (its leftover + processedChunk).
    // processedBytes tells us how much of that combined data was consumed.
    // The separators reference offsets in the combined data.

    // Get the combined data that the indexer worked with
    // by using the leftover before this call + processedChunk
    // Note: This is tricky because the indexer already updated its leftover.
    // We need to reconstruct the combined data.

    // Actually, we can derive this:
    // - Before index(): indexer had some leftover (L1)
    // - After index(): indexer has new leftover (L2) = combined.slice(processedBytes)
    // - combined = L1 + processedChunk
    // - processedData = combined.slice(0, processedBytes) = L1 + processedChunk.slice(0, processedBytes - L1.length)

    // But we don't have L1 (the leftover before the call).
    // We need a different approach: track the combined data ourselves.

    // Simpler approach: Use accumulatedData which we update to match indexer's view
    const currentLeftover = this.indexer.getLeftover();

    // The data that was processed is: previousAccumulated[0:processedBytes]
    // But we need to build it from what we have.

    // Alternative: Build the processed data from processedChunk
    // If the indexer had leftover L1, it processed L1 + processedChunk.
    // processedBytes tells us how much was consumed.
    // So the processed data is (L1 + processedChunk).slice(0, processedBytes)

    // Since we're tracking accumulatedData = previous leftover, we can compute:
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

    const dataForTokens = combinedData.slice(0, indexResult.processedBytes);

    // Update accumulated data to current leftover for next iteration
    this.accumulatedData = currentLeftover;

    // Generate tokens from separators
    // Note: CSVSeparatorIndexer already filters separators for streaming mode
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
  private async *flush(): AsyncIterableIterator<Token> {
    // Get leftover data BEFORE flushing (indexer clears it after flush)
    const leftoverData = this.indexer.getLeftover();

    // Flush the indexer to get remaining separators
    const indexResult = await this.indexer.index();

    if (indexResult.sepCount === 0 && leftoverData.length === 0) {
      // Nothing to flush
      return;
    }

    // Use the leftover data we captured before flush
    const dataForTokens = leftoverData.slice(0, indexResult.processedBytes);

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
