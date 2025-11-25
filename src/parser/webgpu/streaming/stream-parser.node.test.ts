/**
 * WebGPU StreamParser tests in Node.js environment
 *
 * Uses the webgpu npm package (Google Dawn) to run GPU tests without a browser.
 */

import { describe } from "vitest";
import {
  expect,
  skipIfNoWebGPU,
  test,
} from "@/__tests__/webgpu/webgpu-fixture.ts";
import type { CSVRecord } from "../indexing/types.ts";
import { StreamParser } from "./stream-parser.ts";

/**
 * Helper to create a ReadableStream from a string
 */
function stringToBinaryStream(data: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

/**
 * Helper to parse CSV and collect records
 */
async function parseCSV(gpu: GPU, csvData: string): Promise<CSVRecord[]> {
  const records: CSVRecord[] = [];

  const parser = new StreamParser({
    onRecord: (record) => {
      records.push(record);
    },
    config: {
      // Pass the GPU instance from the fixture
      gpu,
    },
  });

  await parser.initialize();
  await parser.parseStream(stringToBinaryStream(csvData));
  await parser.destroy();

  return records;
}

describe("StreamParser in Node.js with WebGPU", () => {
  test("should parse simple CSV", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    const csvData = "name,age\nAlice,30\nBob,25";
    const records = await parseCSV(gpu, csvData);

    expect(records).toHaveLength(3);
    expect(records[0]!.fields.map((f) => f.value)).toEqual(["name", "age"]);
    expect(records[1]!.fields.map((f) => f.value)).toEqual(["Alice", "30"]);
    expect(records[2]!.fields.map((f) => f.value)).toEqual(["Bob", "25"]);
  });

  test("should handle quoted fields", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    const csvData =
      'name,description\n"Alice","Hello, World"\n"Bob","Line1\\nLine2"';
    const records = await parseCSV(gpu, csvData);

    expect(records).toHaveLength(3);
    expect(records[1]!.fields[0]!.value).toBe("Alice");
    expect(records[1]!.fields[1]!.value).toBe("Hello, World");
  });

  test("should handle long quoted fields (>256 bytes)", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    // This tests the two-pass algorithm for cross-workgroup quote propagation
    const longText = "x".repeat(300);
    const csvData = `name,data\n"Test","${longText}"\n"End","short"`;
    const records = await parseCSV(gpu, csvData);

    expect(records).toHaveLength(3);

    const testRecord = records.find((r) =>
      r.fields.some((f) => f.value === "Test"),
    );
    expect(testRecord).toBeDefined();
    expect(testRecord!.fields[1]!.value).toBe(longText);
  });

  test("should handle commas inside quoted fields", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    const csvData = 'a,b\n"1,2,3","4,5,6"';
    const records = await parseCSV(gpu, csvData);

    expect(records).toHaveLength(2);
    expect(records[1]!.fields[0]!.value).toBe("1,2,3");
    expect(records[1]!.fields[1]!.value).toBe("4,5,6");
  });

  test("should handle escaped quotes", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    const csvData = 'text\n"He said ""Hello"""';
    const records = await parseCSV(gpu, csvData);

    expect(records).toHaveLength(2);
    expect(records[1]!.fields[0]!.value).toBe('He said "Hello"');
  });
});
