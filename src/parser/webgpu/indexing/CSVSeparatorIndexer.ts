/**
 * CSVSeparatorIndexer - Stateful streaming wrapper for CSV separator indexing
 *
 * This class provides a streaming API for the CSV separator indexer,
 * managing state (leftover bytes, quote state) across multiple chunks.
 *
 * @example
 * ```ts
 * const backend = new CSVSeparatorIndexingBackend();
 * await backend.initialize();
 *
 * const indexer = new CSVSeparatorIndexer({ backend });
 *
 * // Stream processing
 * for await (const chunk of stream) {
 *   const result = await indexer.index(chunk, { stream: true });
 *   // Process result.separators...
 * }
 *
 * // Flush remaining data
 * const final = await indexer.index();
 *
 * await backend.destroy();
 * ```
 */

import type { CSVSeparatorIndexResult } from "@/parser/webgpu/indexing/types.ts";
import { packSeparator } from "@/parser/webgpu/utils/separator-utils.ts";
import { concatUint8Arrays } from "@/webgpu/utils/concatUint8Arrays.ts";

/**
 * Interface for CSVSeparatorIndexingBackend
 *
 * Defines the minimal interface required from a backend.
 * This allows for dependency injection and testing with mock backends.
 */
export interface CSVSeparatorIndexingBackendInterface {
  readonly isInitialized: boolean;
  getMaxChunkSize(): number;
  run(
    chunk: Uint8Array,
    prevInQuote: boolean,
  ): Promise<CSVSeparatorIndexResult>;
}

/**
 * Options for the index() method
 */
export interface CSVSeparatorIndexerIndexOptions {
  /**
   * When true, maintains state for streaming and only returns
   * separators for complete records (up to last LF).
   * When false (flush), returns all remaining separators.
   * @default false
   */
  stream?: boolean;
}

/**
 * Configuration for CSVSeparatorIndexer
 */
export interface CSVSeparatorIndexerConfig {
  /**
   * The backend to use for GPU computation.
   * Must be initialized before calling index().
   */
  backend: CSVSeparatorIndexingBackendInterface;
}

/**
 * Stateful streaming wrapper for CSV separator indexing.
 *
 * Manages leftover bytes and quote state across multiple chunks,
 * similar to StringCSVLexer's `lex(chunk, { stream: true })` pattern.
 */
export class CSVSeparatorIndexer {
  private readonly backend: CSVSeparatorIndexingBackendInterface;
  private leftover: Uint8Array = new Uint8Array(0);
  private prevInQuote = false;

  constructor(config: CSVSeparatorIndexerConfig) {
    this.backend = config.backend;
  }

  /**
   * Index CSV separators in the given chunk.
   *
   * @param chunk - CSV data chunk to process. If omitted, flushes remaining data.
   * @param options - Indexing options
   * @returns Index result with separators, counts, and state
   *
   * @example
   * ```ts
   * // Streaming mode - maintains state between chunks
   * const result = await indexer.index(chunk, { stream: true });
   *
   * // Flush mode - process remaining data
   * const final = await indexer.index();
   * ```
   */
  async index(
    chunk?: Uint8Array,
    options: CSVSeparatorIndexerIndexOptions = {},
  ): Promise<CSVSeparatorIndexResult> {
    const { stream = false } = options;

    if (!this.backend.isInitialized) {
      throw new Error(
        "CSVSeparatorIndexer: Backend is not initialized. Call backend.initialize() first.",
      );
    }

    // Flush mode: no new chunk provided
    if (chunk === undefined) {
      return this.flush();
    }

    // Combine leftover with new chunk
    const combined =
      this.leftover.length > 0
        ? concatUint8Arrays(this.leftover, chunk)
        : chunk;

    // Process with backend, handling large chunks if necessary
    const result = await this.processChunk(combined);

    if (stream) {
      // Streaming mode: save unprocessed bytes for next iteration
      const processedBytes = result.processedBytes;

      if (processedBytes < combined.length) {
        // Save leftover bytes (after last LF)
        this.leftover = combined.slice(processedBytes);
      } else {
        this.leftover = new Uint8Array(0);
      }

      // Update quote state for next chunk
      // In streaming mode, we need the quote state at the processed boundary
      // Since processedBytes is after the last LF, and LF resets quote state,
      // the quote state at the boundary is always false (outside quote)
      this.prevInQuote = false;

      // Filter separators to only include those within processedBytes
      // The backend returns ALL separators, but for streaming we only want
      // those within the processed region (up to last LF)
      let validSepCount = 0;
      for (let i = 0; i < result.sepCount; i++) {
        const offset = result.separators[i]! & 0x7fffffff;
        if (offset < processedBytes) {
          validSepCount++;
        } else {
          break; // Separators are sorted, so we can stop early
        }
      }

      return {
        separators: result.separators,
        sepCount: validSepCount,
        processedBytes,
        endInQuote: result.endInQuote,
      };
    }
    // Non-streaming mode: clear state and return all
    this.leftover = new Uint8Array(0);
    this.prevInQuote = result.endInQuote;

    return result;
  }

  /**
   * Get the current leftover buffer.
   *
   * Returns a copy of the unprocessed bytes from the last streaming call.
   * Useful for token generation during flush.
   */
  getLeftover(): Uint8Array {
    return this.leftover;
  }

  /**
   * Reset the indexer state.
   *
   * Clears leftover bytes and resets quote state.
   * Call this when starting to process a new CSV file.
   */
  reset(): void {
    this.leftover = new Uint8Array(0);
    this.prevInQuote = false;
  }

  /**
   * Flush remaining data without streaming state management.
   */
  private async flush(): Promise<CSVSeparatorIndexResult> {
    if (this.leftover.length === 0) {
      // Nothing to flush
      return {
        separators: new Uint32Array(0),
        sepCount: 0,
        processedBytes: 0,
        endInQuote: this.prevInQuote,
      };
    }

    // Process remaining leftover
    const result = await this.processChunk(this.leftover);

    // For flush, if there's no LF at the end, we need to add a virtual one
    // to properly terminate the last record (or indicate incomplete data)
    // Actually, for flush we return processedBytes = leftover.length to indicate
    // all data was consumed, even if there's no trailing LF

    // Clear state after flush
    const leftoverLength = this.leftover.length;
    this.leftover = new Uint8Array(0);
    this.prevInQuote = false;

    // Return result with processedBytes = total length (all consumed)
    return {
      separators: result.separators,
      sepCount: result.sepCount,
      processedBytes: leftoverLength,
      endInQuote: result.endInQuote,
    };
  }

  /**
   * Process a chunk, splitting if it exceeds the backend's max chunk size.
   */
  private async processChunk(
    chunk: Uint8Array,
  ): Promise<CSVSeparatorIndexResult> {
    const maxChunkSize = this.backend.getMaxChunkSize();

    if (chunk.length <= maxChunkSize) {
      // Single chunk processing
      return this.backend.run(chunk, this.prevInQuote);
    }

    // Large chunk: split and process in parts
    // Note: This is a rare case for streaming, but we handle it for completeness
    const allSeparators: number[] = [];
    let currentQuoteState = this.prevInQuote;
    let totalProcessedBytes = 0;
    let offset = 0;

    while (offset < chunk.length) {
      const end = Math.min(offset + maxChunkSize, chunk.length);
      const subChunk = chunk.slice(offset, end);

      const subResult = await this.backend.run(subChunk, currentQuoteState);

      // Collect separators with adjusted offsets
      for (let i = 0; i < subResult.sepCount; i++) {
        const packed = subResult.separators[i]!;
        const sepOffset = packed & 0x7fffffff;
        const sepType = (packed >>> 31) as 0 | 1;
        // Adjust offset to be relative to the original chunk
        allSeparators.push(packSeparator(offset + sepOffset, sepType));
      }

      // Track processed bytes (relative to original chunk)
      if (subResult.processedBytes > 0) {
        totalProcessedBytes = offset + subResult.processedBytes;
      }

      currentQuoteState = subResult.endInQuote;
      offset = end;
    }

    // Sort all separators by offset
    const sorted = new Uint32Array(allSeparators);
    sorted.sort((a, b) => (a & 0x7fffffff) - (b & 0x7fffffff));

    return {
      separators: sorted,
      sepCount: sorted.length,
      processedBytes: totalProcessedBytes,
      endInQuote: currentQuoteState,
    };
  }
}
