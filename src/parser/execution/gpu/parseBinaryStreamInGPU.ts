/**
 * WebGPU execution for parseBinaryStream
 *
 * This module provides GPU-accelerated binary stream CSV parsing using WebGPU.
 * It is the core implementation shared by parseBinaryInGPU.
 *
 * Uses a queue-based streaming approach to yield records as they are parsed,
 * rather than buffering all records first.
 *
 * Large chunks are automatically split to stay within GPU dispatch limits.
 */

import type { CSVRecord, ParseBinaryOptions, ParseOptions } from "@/core/types.ts";
import { convertToStandardRecord } from "@/parser/execution/gpu/convertToStandardRecord.ts";
import type { CSVRecord as WebGPUCSVRecord } from "@/parser/webgpu/indexing/types.ts";
import { StreamParser } from "@/parser/webgpu/streaming/stream-parser.ts";

/**
 * Async queue for streaming records from callback-based parser to async generator
 */
class AsyncRecordQueue<T> {
  private queue: T[] = [];
  private waitResolve: ((value: T | null) => void) | null = null;
  private done = false;
  private error: Error | null = null;

  /**
   * Push a record to the queue
   */
  push(record: T): void {
    if (this.waitResolve) {
      // Consumer is waiting, deliver directly
      const resolve = this.waitResolve;
      this.waitResolve = null;
      resolve(record);
    } else {
      // Buffer for later consumption
      this.queue.push(record);
    }
  }

  /**
   * Signal that parsing is complete
   */
  finish(): void {
    this.done = true;
    if (this.waitResolve) {
      const resolve = this.waitResolve;
      this.waitResolve = null;
      resolve(null);
    }
  }

  /**
   * Signal an error occurred
   */
  setError(err: Error): void {
    this.error = err;
    if (this.waitResolve) {
      const resolve = this.waitResolve;
      this.waitResolve = null;
      resolve(null);
    }
  }

  /**
   * Get the next record (async)
   */
  async next(): Promise<T | null> {
    // Check for error first
    if (this.error) {
      throw this.error;
    }

    // Return buffered record if available
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }

    // Check if done
    if (this.done) {
      return null;
    }

    // Wait for next record
    return new Promise((resolve) => {
      this.waitResolve = resolve;
    });
  }
}

/**
 * Parse CSV binary stream using WebGPU
 *
 * @param stream - ReadableStream of CSV bytes (Uint8Array)
 * @param options - Parse options
 * @yields Parsed CSV records as they are parsed (true streaming)
 *
 * @remarks
 * Large chunks are automatically split within StreamParser to stay within
 * GPU dispatch limits (maxComputeWorkgroupsPerDimension * 256 bytes).
 */
export async function* parseBinaryStreamInGPU<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = ",",
  Quotation extends string = '"',
>(
  stream: ReadableStream<Uint8Array>,
  options?:
    | ParseOptions<Header, Delimiter, Quotation>
    | ParseBinaryOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  const queue = new AsyncRecordQueue<WebGPUCSVRecord>();

  // Get device from gpuDeviceManager if provided
  const gpuDeviceManager = options?.engine?.gpuDeviceManager;
  let device: GPUDevice | undefined;

  // Determine header settings
  let header: ReadonlyArray<string> | undefined = options?.header;
  const isHeaderlessMode =
    options?.header !== undefined &&
    Array.isArray(options.header) &&
    options.header.length === 0;
  const outputFormat = options?.outputFormat ?? "object";
  let isFirstRecord = true;

  try {
    if (gpuDeviceManager) {
      device = await gpuDeviceManager.getDevice();
    }

    // Start parsing in background
    const parsePromise = (async () => {
      try {
        await using parser = await StreamParser.create({
          onRecord: (record) => {
            queue.push(record);
          },
          config: device ? { device } : undefined,
        });

        // StreamParser automatically handles large chunks by splitting them
        await parser.parseStream(stream);
        queue.finish();
      } catch (err) {
        queue.setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    // Yield records as they arrive
    while (true) {
      const record = await queue.next();
      if (record === null) {
        break;
      }

      if (isFirstRecord && !header && !isHeaderlessMode) {
        // Use first record as header
        header = record.fields.map((f) => f.value);
        isFirstRecord = false;
        continue; // Don't yield header row
      }

      isFirstRecord = false;
      yield convertToStandardRecord(record, header as Header, outputFormat);
    }

    // Ensure parsing completes (catches any errors)
    await parsePromise;
  } finally {
    // Release device back to manager
    if (gpuDeviceManager) {
      gpuDeviceManager.releaseDevice();
    }
  }
}
