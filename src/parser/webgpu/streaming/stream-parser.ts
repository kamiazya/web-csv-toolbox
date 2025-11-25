/**
 * Streaming CSV Parser using WebGPU for index construction
 *
 * This module implements the high-level streaming API that:
 * 1. Handles chunk-based processing with carry-over buffers
 * 2. Manages BOM detection and CRLF normalization
 * 3. Assembles records from GPU-generated separator indices
 */

import { CSVIndexingBackend } from "@/parser/webgpu/indexing/CSVIndexingBackend.ts";
import type {
  CSVRecord,
  Separator,
  StreamingParserOptions,
  StreamingState,
} from "@/parser/webgpu/indexing/types.ts";
import { adjustForCRLF } from "@/parser/webgpu/utils/adjustForCRLF.ts";
import { decodeUTF8 } from "@/parser/webgpu/utils/decodeUTF8.ts";
import {
  getProcessedBytesCount,
  getValidSeparators,
  isLineFeed,
} from "@/parser/webgpu/utils/separator-utils.ts";
import { stripBOM } from "@/parser/webgpu/utils/stripBOM.ts";
import { concatUint8Arrays } from "@/webgpu/utils/concatUint8Arrays.ts";

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
  private readonly backend: CSVIndexingBackend;
  private readonly options: StreamingParserOptions;
  private state: StreamingState;

  constructor(options: StreamingParserOptions = {}) {
    this.backend = new CSVIndexingBackend(options.config);
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
   *
   * If the chunk exceeds GPU dispatch limits, it is automatically split
   * into smaller sub-chunks and processed sequentially.
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

    // 3. Get max chunk size from GPU device limits
    const maxChunkSize = this.backend.getMaxChunkSize();

    // 4. If input exceeds max size, split and process in sub-chunks
    if (inputBytes.length > maxChunkSize) {
      // Clear leftover since we're processing from scratch
      this.state.leftover = new Uint8Array(0);

      // Process in sub-chunks
      for (let offset = 0; offset < inputBytes.length; offset += maxChunkSize) {
        const subChunk = inputBytes.subarray(
          offset,
          Math.min(offset + maxChunkSize, inputBytes.length),
        );
        await this.processSubChunk(subChunk);
      }
      return;
    }

    // 5. Normal processing for chunks within GPU limits
    await this.processSubChunk(inputBytes);
  }

  /**
   * Processes a sub-chunk that is guaranteed to be within GPU dispatch limits
   */
  private async processSubChunk(inputBytes: Uint8Array): Promise<void> {
    if (inputBytes.length === 0) {
      return;
    }

    // Concatenate with any leftover from previous sub-chunk
    const fullInput = concatUint8Arrays(this.state.leftover, inputBytes);
    this.state.leftover = new Uint8Array(0);

    // Check if we still exceed limits after concatenation (edge case)
    const maxChunkSize = this.backend.getMaxChunkSize();
    if (fullInput.length > maxChunkSize) {
      // Recursively split - this handles edge case where leftover + subchunk > max
      for (let offset = 0; offset < fullInput.length; offset += maxChunkSize) {
        const subChunk = fullInput.subarray(
          offset,
          Math.min(offset + maxChunkSize, fullInput.length),
        );
        await this.processSubChunk(subChunk);
      }
      return;
    }

    // Execute GPU parsing
    const dispatchResult = await this.backend.dispatch(fullInput, {
      chunkSize: fullInput.length,
      prevInQuote: this.state.prevInQuote,
    });
    const result = dispatchResult.data;

    // Determine valid processing range (up to last LF)
    const processedBytesCount = getProcessedBytesCount(
      result.sepIndices,
      result.sepCount,
    );

    if (processedBytesCount === 0) {
      // No complete record found - carry over entire buffer
      // IMPORTANT: Do NOT update prevInQuote here!
      // The leftover contains the entire buffer, which will be re-processed
      // with new data. If we update prevInQuote to endInQuote, the same bytes
      // would be re-parsed with wrong initial quote state.
      this.state.leftover = fullInput;
      // Keep prevInQuote unchanged - it was correct for this buffer's start
      return;
    }

    // Extract valid separators
    const separators = getValidSeparators(result.sepIndices, result.sepCount);

    // Parse records from separator positions
    await this.parseRecords(fullInput, separators, processedBytesCount);

    // Save leftover for next chunk and calculate quote state at processedBytesCount
    this.state.leftover = fullInput.slice(processedBytesCount);

    // Calculate quote state at processedBytesCount position:
    // endInQuote = state at processedBytesCount XOR parity of leftover
    // Therefore: state at processedBytesCount = endInQuote XOR leftover parity
    let leftoverParity = 0;
    for (let i = processedBytesCount; i < fullInput.length; i++) {
      if (fullInput[i] === 34) {
        // 34 = '"'
        leftoverParity ^= 1;
      }
    }
    this.state.prevInQuote = result.endInQuote ^ leftoverParity;
    this.state.globalOffset += processedBytesCount;
  }

  /**
   * Parses records from separator positions
   */
  private async parseRecords(
    inputBytes: Uint8Array,
    separators: Separator[],
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

      // Only add field if:
      // 1. This is not a LF, OR
      // 2. This is a LF but we have content (fields exist or field has content)
      const shouldAddField =
        !isLineFeed(sep) || fields.length > 0 || lastOffset < endOffset;

      if (shouldAddField) {
        fields.push(fieldValue);
      }

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
      // Extract final field after last separator (or add empty field for trailing comma)
      if (lastOffset <= inputBytes.length) {
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
    const dispatchResult = await this.backend.dispatch(this.state.leftover, {
      chunkSize: this.state.leftover.length,
      prevInQuote: this.state.prevInQuote,
    });
    const result = dispatchResult.data;

    // If there are separators, process them
    if (result.sepCount > 0) {
      const separators: Separator[] = [];
      for (let i = 0; i < result.sepCount; i++) {
        const packed = result.sepIndices[i]!;
        separators.push({
          offset: packed & 0x7fffffff,
          type: ((packed >>> 31) & 1) as 0 | 1,
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

  /**
   * Implements AsyncDisposable for automatic cleanup with `await using`
   *
   * @example
   * ```ts
   * await using parser = await StreamParser.create({
   *   onRecord: (record) => console.log(record),
   * });
   * await parser.parseStream(stream);
   * // destroy() is called automatically
   * ```
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy();
  }

  /**
   * Factory method that creates and initializes a StreamParser
   *
   * @param options - Parser options
   * @returns Initialized StreamParser ready for use with `await using`
   *
   * @example
   * ```ts
   * await using parser = await StreamParser.create({
   *   onRecord: (record) => console.log(record),
   * });
   * await parser.parseStream(stream);
   * ```
   */
  static async create(
    options: StreamingParserOptions = {},
  ): Promise<StreamParser> {
    const parser = new StreamParser(options);
    await parser.initialize();
    return parser;
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

  await using parser = await StreamParser.create({
    ...options,
    onRecord: (record) => {
      records.push(record);
    },
  });

  await parser.parseStream(stream);

  return records;
}
