/**
 * Two-Pass Algorithm Validation Test
 *
 * Verifies that the two-pass algorithm correctly handles quote state propagation
 * across workgroup boundaries (>256 bytes).
 */

import { expect, test } from "vitest";
import type { CSVRecord } from "@/parser/webgpu/indexing/types.ts";
import { StreamParser } from "@/parser/webgpu/streaming/stream-parser.ts";
import { isWebGPUAvailable } from "@/webgpu/helpers/isWebGPUAvailable.ts";

/**
 * Helper to parse CSV data and collect records
 * Returns null if WebGPU initialization fails (e.g., in headless environments)
 */
async function parseCSVData(csvData: string): Promise<CSVRecord[] | null> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(csvData);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const records: CSVRecord[] = [];

  const parser = new StreamParser({
    onRecord: (record) => {
      records.push(record);
    },
  });

  try {
    await parser.initialize();
    await parser.parseStream(stream);
    await parser.destroy();
    return records;
  } catch (error) {
    // Skip test if GPU initialization fails (e.g., in headless CI environments)
    if (
      error instanceof Error &&
      (error.message.includes("WebGPU") ||
        error.message.includes("GPU adapter") ||
        error.message.includes("GPU device"))
    ) {
      return null;
    }
    throw error;
  }
}

test.skipIf(!isWebGPUAvailable())(
  "should correctly handle quoted field longer than 256 bytes",
  async () => {
    // Create a quoted field with content > 256 bytes
    // This ensures the field spans multiple workgroups (256 bytes each)
    const longText = "a".repeat(300); // 300 characters
    const csvData = `name,description\n"Alice","${longText}"\n"Bob","short"`;

    const records = await parseCSVData(csvData);
    if (records === null) {
      return; // Skip if WebGPU not available
    }

    // Verify results (header is skipped by default, so we have 2 data records)
    // Note: If header is not skipped, adjust expectations accordingly
    expect(records.length).toBeGreaterThanOrEqual(2);

    // Find the record with "Alice"
    const aliceRecord = records.find((r) =>
      r.fields.some((f) => f.value === "Alice"),
    );
    const bobRecord = records.find((r) =>
      r.fields.some((f) => f.value === "Bob"),
    );

    expect(aliceRecord).toBeDefined();
    expect(bobRecord).toBeDefined();

    if (aliceRecord) {
      expect(aliceRecord.fields).toHaveLength(2);
      expect(aliceRecord.fields[0]!.value).toBe("Alice");
      expect(aliceRecord.fields[1]!.value).toBe(longText);
    }

    if (bobRecord) {
      expect(bobRecord.fields).toHaveLength(2);
      expect(bobRecord.fields[0]!.value).toBe("Bob");
      expect(bobRecord.fields[1]!.value).toBe("short");
    }
  },
);

test.skipIf(!isWebGPUAvailable())(
  "should handle comma inside long quoted field (>256 bytes)",
  async () => {
    // Test that commas inside a long quoted field are not treated as separators
    const longTextWithComma = "a,".repeat(200); // 400 characters with commas
    const csvData = `name,data\n"Test","${longTextWithComma}"\n"End","final"`;

    const records = await parseCSVData(csvData);
    if (records === null) {
      return; // Skip if WebGPU not available
    }

    // Find records
    const testRecord = records.find((r) =>
      r.fields.some((f) => f.value === "Test"),
    );
    const endRecord = records.find((r) =>
      r.fields.some((f) => f.value === "End"),
    );

    expect(testRecord).toBeDefined();
    expect(endRecord).toBeDefined();

    if (testRecord) {
      // Should be 2 fields, not fragmented by commas inside quotes
      expect(testRecord.fields).toHaveLength(2);
      expect(testRecord.fields[0]!.value).toBe("Test");
      expect(testRecord.fields[1]!.value).toBe(longTextWithComma);
    }

    if (endRecord) {
      expect(endRecord.fields).toHaveLength(2);
      expect(endRecord.fields[0]!.value).toBe("End");
      expect(endRecord.fields[1]!.value).toBe("final");
    }
  },
);

test.skipIf(!isWebGPUAvailable())(
  "should handle newline inside long quoted field (>256 bytes)",
  async () => {
    // Test that newlines inside a long quoted field are preserved
    const longTextWithNewline = "line1\nline2\n".repeat(50); // ~600 chars
    const csvData = `name,multiline\n"Test","${longTextWithNewline}"\n"End","final"`;

    const records = await parseCSVData(csvData);
    if (records === null) {
      return; // Skip if WebGPU not available
    }

    // Find records
    const testRecord = records.find((r) =>
      r.fields.some((f) => f.value === "Test"),
    );
    const endRecord = records.find((r) =>
      r.fields.some((f) => f.value === "End"),
    );

    expect(testRecord).toBeDefined();
    expect(endRecord).toBeDefined();

    if (testRecord) {
      // Should be 2 fields, not split by newlines inside quotes
      expect(testRecord.fields).toHaveLength(2);
      expect(testRecord.fields[0]!.value).toBe("Test");
      expect(testRecord.fields[1]!.value).toBe(longTextWithNewline);
    }

    if (endRecord) {
      expect(endRecord.fields).toHaveLength(2);
      expect(endRecord.fields[0]!.value).toBe("End");
      expect(endRecord.fields[1]!.value).toBe("final");
    }
  },
);

test.skipIf(!isWebGPUAvailable())(
  "should handle multiple workgroups with alternating quote states",
  async () => {
    // Create CSV with multiple transitions across workgroup boundaries
    // Pattern: quoted field (300 bytes) -> plain -> quoted (300 bytes) -> plain
    const long1 = "x".repeat(300);
    const long2 = "y".repeat(300);
    const csvData = `f1,f2,f3,f4\n"${long1}",plain1,"${long2}",plain2`;

    const records = await parseCSVData(csvData);
    if (records === null) {
      return; // Skip if WebGPU not available
    }

    // Find the data record (not header)
    const dataRecord = records.find((r) =>
      r.fields.some((f) => f.value === "plain1"),
    );

    expect(dataRecord).toBeDefined();

    if (dataRecord) {
      expect(dataRecord.fields).toHaveLength(4);
      expect(dataRecord.fields[0]!.value).toBe(long1);
      expect(dataRecord.fields[1]!.value).toBe("plain1");
      expect(dataRecord.fields[2]!.value).toBe(long2);
      expect(dataRecord.fields[3]!.value).toBe("plain2");
    }
  },
);
