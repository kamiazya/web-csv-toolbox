/**
 * Large File GPU Parsing Tests
 *
 * Tests GPU parser performance and correctness with files >100MB.
 * These tests validate that GPU acceleration provides benefits for large files.
 */

import { describe } from "vitest";
import {
  expect,
  skipIfNoWebGPU,
  test,
} from "@/__tests__/webgpu/webgpu-fixture.ts";
import { parseBinaryStreamInGPU } from "./parseBinaryStreamInGPU.ts";
import { parseBinaryStream } from "@/parser/api/binary/parseBinaryStream.ts";

/**
 * Generate large CSV data for testing
 *
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @returns CSV string
 */
function generateLargeCSV(rows: number, cols: number): string {
  const header = Array.from({ length: cols }, (_, i) => `col${i}`).join(",");
  const dataRow = Array.from({ length: cols }, (_, i) => `value${i}`).join(",");

  const lines = [header];
  for (let i = 0; i < rows; i++) {
    lines.push(dataRow);
  }

  return lines.join("\n");
}

/**
 * Convert string to ReadableStream
 */
function stringToStream(str: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(str);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("Large File GPU Parsing Tests", () => {
  test(
    "GPU: should handle 100MB CSV file",
    { timeout: 60000 }, // 60 second timeout
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      // Generate ~100MB CSV (approximately 1M rows × 10 columns)
      // Each row is roughly 100 bytes: "col0,col1,...,col9\n" + "value0,value1,...,value9\n"
      const rows = 1_000_000;
      const cols = 10;
      const csv = generateLargeCSV(rows, cols);
      const sizeInMB = csv.length / (1024 * 1024);

      console.log(`  Generated CSV: ${rows} rows, ${cols} cols, ~${sizeInMB.toFixed(1)}MB`);

      // Parse with GPU
      const gpuStartTime = performance.now();
      const gpuRecords: Record<string, string>[] = [];
      for await (const record of parseBinaryStreamInGPU(stringToStream(csv))) {
        gpuRecords.push(record as Record<string, string>);
      }
      const gpuEndTime = performance.now();
      const gpuTime = gpuEndTime - gpuStartTime;

      console.log(`  GPU parsing time: ${gpuTime.toFixed(2)}ms`);
      console.log(`  GPU throughput: ${(sizeInMB / (gpuTime / 1000)).toFixed(2)} MB/s`);

      // Verify record count
      expect(gpuRecords.length).toBe(rows);

      // Verify first record structure
      expect(gpuRecords[0]).toHaveProperty("col0");
      expect(gpuRecords[0]).toHaveProperty("col9");
      expect(gpuRecords[0]?.col0).toBe("value0");
    }
  );

  test(
    "GPU vs CPU: compare performance on large file (200MB)",
    { timeout: 120000 }, // 120 second timeout
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      // Generate ~200MB CSV (2M rows × 10 columns)
      const rows = 2_000_000;
      const cols = 10;
      const csv = generateLargeCSV(rows, cols);
      const sizeInMB = csv.length / (1024 * 1024);

      console.log(`  Generated CSV: ${rows} rows, ${cols} cols, ~${sizeInMB.toFixed(1)}MB`);

      // Parse with GPU
      const gpuStartTime = performance.now();
      const gpuRecords: Record<string, string>[] = [];
      for await (const record of parseBinaryStreamInGPU(stringToStream(csv))) {
        gpuRecords.push(record as Record<string, string>);
      }
      const gpuEndTime = performance.now();
      const gpuTime = gpuEndTime - gpuStartTime;

      // Parse with CPU (JavaScript engine)
      const cpuStartTime = performance.now();
      const cpuRecords: Record<string, string>[] = [];
      for await (const record of parseBinaryStream(stringToStream(csv), {
        engine: { wasm: false, gpu: false },
        // Increase buffer size limit for large file testing
        maxBufferSize: 200 * 1024 * 1024, // 200MB
      })) {
        cpuRecords.push(record as Record<string, string>);
      }
      const cpuEndTime = performance.now();
      const cpuTime = cpuEndTime - cpuStartTime;

      console.log(`  GPU parsing time: ${gpuTime.toFixed(2)}ms (${(sizeInMB / (gpuTime / 1000)).toFixed(2)} MB/s)`);
      console.log(`  CPU parsing time: ${cpuTime.toFixed(2)}ms (${(sizeInMB / (cpuTime / 1000)).toFixed(2)} MB/s)`);
      console.log(`  Speedup: ${(cpuTime / gpuTime).toFixed(2)}x`);

      // Verify both parsers produce same number of records
      expect(gpuRecords.length).toBe(cpuRecords.length);
      expect(gpuRecords.length).toBe(rows);

      // GPU should be faster for large files (expected 1.4-1.5x speedup)
      // Note: This is a performance assertion, may vary by hardware
      expect(gpuTime).toBeLessThan(cpuTime);
    }
  );

  test(
    "GPU: should handle streaming of 150MB CSV file",
    { timeout: 90000 }, // 90 second timeout
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      // Generate ~150MB CSV (1.5M rows × 10 columns)
      const rows = 1_500_000;
      const cols = 10;
      const csv = generateLargeCSV(rows, cols);
      const sizeInMB = csv.length / (1024 * 1024);

      console.log(`  Generated CSV: ${rows} rows, ${cols} cols, ~${sizeInMB.toFixed(1)}MB`);

      // Parse with GPU (streaming - don't collect all records)
      const gpuStartTime = performance.now();
      let recordCount = 0;
      let firstRecord: Record<string, string> | null = null;
      let lastRecord: Record<string, string> | null = null;

      for await (const record of parseBinaryStreamInGPU(stringToStream(csv))) {
        if (recordCount === 0) {
          firstRecord = record as Record<string, string>;
        }
        lastRecord = record as Record<string, string>;
        recordCount++;
      }
      const gpuEndTime = performance.now();
      const gpuTime = gpuEndTime - gpuStartTime;

      console.log(`  GPU streaming time: ${gpuTime.toFixed(2)}ms`);
      console.log(`  GPU throughput: ${(sizeInMB / (gpuTime / 1000)).toFixed(2)} MB/s`);
      console.log(`  Records processed: ${recordCount}`);

      // Verify record count
      expect(recordCount).toBe(rows);

      // Verify first and last records
      expect(firstRecord).not.toBeNull();
      expect(lastRecord).not.toBeNull();
      expect(firstRecord?.col0).toBe("value0");
      expect(lastRecord?.col0).toBe("value0");
    }
  );

  test(
    "GPU: should handle CSV with long fields (stress test)",
    { timeout: 60000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      // Generate CSV with long fields (~100KB each)
      // This tests GPU buffer handling for large field sizes
      const rows = 1000;
      const cols = 5;
      const longValue = "x".repeat(100000); // 100KB field

      const header = Array.from({ length: cols }, (_, i) => `col${i}`).join(",");
      const dataRow = Array.from({ length: cols }, () => longValue).join(",");

      const lines = [header];
      for (let i = 0; i < rows; i++) {
        lines.push(dataRow);
      }

      const csv = lines.join("\n");
      const sizeInMB = csv.length / (1024 * 1024);

      console.log(`  Generated CSV with long fields: ${rows} rows, ${cols} cols, ~${sizeInMB.toFixed(1)}MB`);

      // Parse with GPU
      const gpuStartTime = performance.now();
      const gpuRecords: Record<string, string>[] = [];
      for await (const record of parseBinaryStreamInGPU(stringToStream(csv))) {
        gpuRecords.push(record as Record<string, string>);
      }
      const gpuEndTime = performance.now();
      const gpuTime = gpuEndTime - gpuStartTime;

      console.log(`  GPU parsing time: ${gpuTime.toFixed(2)}ms`);

      // Verify record count
      expect(gpuRecords.length).toBe(rows);

      // Verify field values
      expect(gpuRecords[0]?.col0).toBe(longValue);
      expect(gpuRecords[0]?.col0?.length).toBe(100000);
    }
  );
});
