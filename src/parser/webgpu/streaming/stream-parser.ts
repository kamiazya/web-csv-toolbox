/**
 * Streaming CSV Parser using WebGPU for index construction
 *
 * This module implements the high-level streaming API that:
 * 1. Handles chunk-based processing with carry-over buffers
 * 2. Manages BOM detection and CRLF normalization
 * 3. Assembles records from GPU-generated separator indices
 */

import { GPUBackend } from "../core/gpu-backend.ts";
import type {
  CSVRecord,
  StreamingParserOptions,
  StreamingState,
} from "../core/types.ts";
import {
  adjustForCRLF,
  concatUint8Arrays,
  decodeUTF8,
  stripBOM,
} from "../utils/buffer-utils.ts";
import {
  getProcessedBytesCount,
  getValidSeparators,
  isLineFeed,
} from "../utils/separator-utils.ts";

/**
 * WebGPU-accelerated streaming CSV parser
 *
 * @example
 * ```ts
 * const parser = new StreamParser({
 *   onRecord: (record) => console.log(record),
 * });
 *
 * await parser.initialize();
 *
 * const response = await fetch('data.csv');
 * await parser.parseStream(response.body);
 *
 * await parser.destroy();
 * ```
 */
export class StreamParser {
  private readonly backend: GPUBackend;
  private readonly options: StreamingParserOptions;
  private state: StreamingState;

  constructor(options: StreamingParserOptions = {}) {
    this.backend = new GPUBackend(options.config);
    this.options = options;
    this.state = this.createInitialState();
  }

  /**
   * Creates initial parser state
   */
  private createInitialState(): StreamingState {
    return {
      leftover: new Uint8Array(0),
      prevInQuote: 0,
      isFirstChunk: true,
      recordIndex: 0,
      globalOffset: 0,
    };
  }

  /**
   * Initializes the GPU backend
   */
  async initialize(): Promise<void> {
    await this.backend.initialize();
  }

  /**
   * Parses a ReadableStream of CSV data
   *
   * @param stream - ReadableStream containing CSV bytes
   */
  async parseStream(stream: ReadableStream<Uint8Array> | null): Promise<void> {
    if (!stream) {
      throw new Error("Stream is null");
    }

    const reader = stream.getReader();
    this.state = this.createInitialState();

    try {
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;

        await this.processChunk(chunk);
      }

      // Process any remaining data
      await this.finalize();
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Processes a single chunk of CSV data
   */
  private async processChunk(chunk: Uint8Array): Promise<void> {
    // 1. BOM detection (first chunk only)
    let processedChunk = chunk;
    if (this.state.isFirstChunk && !this.options.skipBOM) {
      processedChunk = stripBOM(chunk);
      this.state.isFirstChunk = false;
    }

    // 2. Concatenate with leftover from previous chunk
    const inputBytes = concatUint8Arrays(this.state.leftover, processedChunk);

    if (inputBytes.length === 0) {
      return;
    }

    // 3. Execute GPU parsing
    const result = await this.backend.dispatch(inputBytes, {
      chunkSize: inputBytes.length,
      prevInQuote: this.state.prevInQuote,
    });

    // 4. Determine valid processing range (up to last LF)
    const processedBytesCount = getProcessedBytesCount(
      result.sepIndices,
      result.sepCount,
    );

    if (processedBytesCount === 0) {
      // No complete record found - carry over entire buffer
      this.state.leftover = inputBytes;
      this.state.prevInQuote = result.endInQuote;
      return;
    }

    // 5. Extract valid separators
    const separators = getValidSeparators(result.sepIndices, result.sepCount);

    // 6. Parse records from separator positions
    await this.parseRecords(inputBytes, separators, processedBytesCount);

    // 7. Save leftover for next chunk
    this.state.leftover = inputBytes.slice(processedBytesCount);
    this.state.prevInQuote = 0; // Reset because we ended on a newline
    this.state.globalOffset += processedBytesCount;
  }

  /**
   * Parses records from separator positions
   */
  private async parseRecords(
    inputBytes: Uint8Array,
    separators: Array<{ offset: number; type: number }>,
    _processedBytesCount: number,
    emitTrailingFields = false,
  ): Promise<void> {
    const fields: string[] = [];
    let lastOffset = 0;

    for (const sep of separators) {
      // Adjust end position for CRLF
      const endOffset = isLineFeed(sep)
        ? adjustForCRLF(inputBytes, sep.offset)
        : sep.offset;

      // Extract field value
      let fieldValue = decodeUTF8(inputBytes, lastOffset, endOffset);

      // Handle quoted fields: strip quotes and unescape internal quotes
      if (
        fieldValue.length >= 2 &&
        fieldValue[0] === '"' &&
        fieldValue[fieldValue.length - 1] === '"'
      ) {
        // Remove surrounding quotes
        fieldValue = fieldValue.slice(1, -1);
        // Unescape doubled quotes ("" -> ")
        fieldValue = fieldValue.replace(/""/g, '"');
      }

      fields.push(fieldValue);

      // If this is a line feed, emit the record
      if (isLineFeed(sep)) {
        await this.emitRecord(fields);
        fields.length = 0; // Clear fields array
      }

      // Move to next field start (after separator)
      lastOffset = sep.offset + 1;
    }

    // Handle any remaining fields (happens at end of stream without trailing LF)
    if (emitTrailingFields) {
      // Extract final field after last separator
      if (lastOffset < inputBytes.length) {
        let finalField = decodeUTF8(inputBytes, lastOffset, inputBytes.length);

        // Handle quoted field
        if (
          finalField.length >= 2 &&
          finalField[0] === '"' &&
          finalField[finalField.length - 1] === '"'
        ) {
          finalField = finalField.slice(1, -1).replace(/""/g, '"');
        }

        fields.push(finalField);
      }

      // Emit the record if there are any fields
      if (fields.length > 0) {
        await this.emitRecord(fields);
      }
    }
  }

  /**
   * Emits a parsed record
   */
  private async emitRecord(fields: string[]): Promise<void> {
    if (!this.options.onRecord) {
      return;
    }

    const record: CSVRecord = {
      fields: fields.map((value, _index) => ({
        start: 0, // Would need to track actual positions for lazy loading
        end: 0,
        value,
      })),
      recordIndex: this.state.recordIndex++,
    };

    try {
      await this.options.onRecord(record);
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Processes any remaining data after stream ends
   */
  private async finalize(): Promise<void> {
    if (this.state.leftover.length === 0) {
      return;
    }

    // Process leftover as final chunk
    const result = await this.backend.dispatch(this.state.leftover, {
      chunkSize: this.state.leftover.length,
      prevInQuote: this.state.prevInQuote,
    });

    // If there are separators, process them
    if (result.sepCount > 0) {
      const separators = [];
      for (let i = 0; i < result.sepCount; i++) {
        const packed = result.sepIndices[i];
        separators.push({
          offset: packed & 0x7fffffff,
          type: (packed >>> 31) & 1,
        });
      }

      await this.parseRecords(
        this.state.leftover,
        separators,
        this.state.leftover.length,
        true, // Emit trailing fields at end of stream
      );
    } else {
      // No separators - treat entire leftover as single field/record
      let value = decodeUTF8(
        this.state.leftover,
        0,
        this.state.leftover.length,
      );

      // Handle quoted field
      if (
        value.length >= 2 &&
        value[0] === '"' &&
        value[value.length - 1] === '"'
      ) {
        value = value.slice(1, -1).replace(/""/g, '"');
      }

      await this.emitRecord([value]);
    }
  }

  /**
   * Resets parser state for reuse
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * Cleans up GPU resources
   */
  async destroy(): Promise<void> {
    await this.backend.destroy();
  }
}

/**
 * Convenience function to parse a CSV stream with WebGPU
 *
 * @param stream - ReadableStream containing CSV data
 * @param options - Parser options
 * @returns Array of parsed records
 *
 * @example
 * ```ts
 * const response = await fetch('data.csv');
 * const records = await parseCSVStream(response.body, {
 *   config: { chunkSize: 2 * 1024 * 1024 }, // 2MB chunks
 * });
 * console.log(records);
 * ```
 */
export async function parseCSVStream(
  stream: ReadableStream<Uint8Array> | null,
  options: Omit<StreamingParserOptions, "onRecord"> = {},
): Promise<CSVRecord[]> {
  const records: CSVRecord[] = [];

  const parser = new StreamParser({
    ...options,
    onRecord: (record) => {
      records.push(record);
    },
  });

  await parser.initialize();
  await parser.parseStream(stream);
  await parser.destroy();

  return records;
}
