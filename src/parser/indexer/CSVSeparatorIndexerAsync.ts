import type { CSVSeparatorIndexResult } from "../types/SeparatorIndexResult.ts";
import { concatUint8Arrays } from "../utils/separatorUtils.ts";
import type { CSVIndexerBackendAsync } from "./CSVSeparatorIndexer.ts";

// Re-export for convenience
export type { CSVIndexerBackendAsync };

/**
 * Options for the index() method
 */
export interface CSVSeparatorIndexerOptions {
  /**
   * Enable streaming mode
   *
   * When true:
   * - Unprocessed bytes (after last LF) are saved as leftover
   * - Quote state resets to false after LF
   * - Only separators within processedBytes are valid
   *
   * When false (default):
   * - All bytes are processed
   * - Quote state is carried to next call
   * - All separators are valid
   */
  stream?: boolean;
}

/**
 * Async CSV Separator Indexer with streaming support (for WebGPU)
 *
 * This class wraps an async backend (WebGPU, etc.) and provides:
 * - Leftover byte management for streaming
 * - Quote state tracking across chunks
 * - Unified interface for different async backends
 *
 * @example
 * ```typescript
 * const backend = new GPUIndexerBackend(44); // comma delimiter
 * await backend.initialize();
 *
 * const indexer = new CSVSeparatorIndexerAsync(backend);
 *
 * // Streaming mode
 * for await (const chunk of stream) {
 *   const result = await indexer.index(chunk, { stream: true });
 *   processResult(result);
 * }
 * // Flush remaining data
 * const final = await indexer.index();
 * processResult(final);
 * ```
 */
export class CSVSeparatorIndexerAsync {
  /** Leftover bytes from previous chunk (after last LF) */
  private leftover: Uint8Array = new Uint8Array(0);

  /** Quote state carried from previous chunk */
  private prevInQuote = false;

  /** The async backend implementation */
  private readonly backend: CSVIndexerBackendAsync;

  /**
   * Create a new CSVSeparatorIndexerAsync
   * @param backend - The async backend to use for scanning (e.g., GPUIndexerBackend)
   */
  constructor(backend: CSVIndexerBackendAsync) {
    this.backend = backend;
  }

  /**
   * Index CSV separators with streaming support (async)
   *
   * @param chunk - Data chunk to process. Omit to flush remaining data.
   * @param options - Indexing options
   * @returns Promise resolving to CSVSeparatorIndexResult with separator positions and metadata
   *
   * @example Non-streaming (one-shot)
   * ```typescript
   * const result = await indexer.index(csvBytes);
   * ```
   *
   * @example Streaming
   * ```typescript
   * for (const chunk of chunks) {
   *   const result = await indexer.index(chunk, { stream: true });
   *   // Process result.separators up to result.sepCount
   * }
   * const final = await indexer.index(); // Flush
   * ```
   */
  async index(
    chunk?: Uint8Array,
    options: CSVSeparatorIndexerOptions = {},
  ): Promise<CSVSeparatorIndexResult> {
    const { stream = false } = options;

    // Flush mode: process remaining leftover
    if (chunk === undefined) {
      return await this.flush();
    }

    // Combine leftover with new chunk
    const combined =
      this.leftover.length > 0
        ? concatUint8Arrays(this.leftover, chunk)
        : chunk;

    // Scan through backend (async)
    const result = await this.backend.scan(combined, this.prevInQuote);

    if (stream) {
      // Save unprocessed bytes (after last LF)
      if (result.processedBytes < combined.length) {
        this.leftover = combined.slice(result.processedBytes);
      } else {
        this.leftover = new Uint8Array(0);
      }

      // Quote state resets to false after LF (we've processed complete rows)
      this.prevInQuote = false;

      // Filter separators to valid range
      // Note: Extended format uses bits 0-29 for offset (mask 0x3FFFFFFF),
      // but we use 0x7FFFFFFF for backward compatibility with standard format
      // since the offset is the same in lower bits.
      let validSepCount = 0;
      for (let i = 0; i < result.sepCount; i++) {
        const offset = result.separators[i]! & 0x3fffffff; // Use extended format mask
        if (offset < result.processedBytes) {
          validSepCount++;
        } else {
          break;
        }
      }

      return {
        separators: result.separators,
        sepCount: validSepCount,
        processedBytes: result.processedBytes,
        endInQuote: false, // Always false after LF in streaming mode
        unescapeFlags: result.unescapeFlags,
      };
    }

    // Non-streaming mode: process everything
    this.leftover = new Uint8Array(0);
    this.prevInQuote = result.endInQuote;
    return result;
  }

  /**
   * Reset the indexer state
   *
   * Call this to start processing a new file or stream.
   */
  reset(): void {
    this.leftover = new Uint8Array(0);
    this.prevInQuote = false;
  }

  /**
   * Get the current leftover bytes
   *
   * These are the bytes after the last LF that haven't been fully processed yet.
   */
  getLeftover(): Uint8Array {
    return this.leftover;
  }

  /**
   * Check if there's any leftover data
   */
  hasLeftover(): boolean {
    return this.leftover.length > 0;
  }

  /**
   * Flush remaining data (async)
   *
   * Process any leftover bytes as the final chunk (no trailing LF expected).
   */
  private async flush(): Promise<CSVSeparatorIndexResult> {
    if (this.leftover.length === 0) {
      return {
        separators: new Uint32Array(0),
        sepCount: 0,
        processedBytes: 0,
        endInQuote: this.prevInQuote,
      };
    }

    // Process leftover as final chunk (async)
    const result = await this.backend.scan(this.leftover, this.prevInQuote);
    const leftoverLength = this.leftover.length;

    // Clear state
    this.leftover = new Uint8Array(0);
    this.prevInQuote = false;

    return {
      ...result,
      // Override processedBytes to include all remaining data
      processedBytes: leftoverLength,
    };
  }
}
