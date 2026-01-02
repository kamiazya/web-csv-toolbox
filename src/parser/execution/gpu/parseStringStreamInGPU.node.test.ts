/**
 * Tests for parseStringStreamInGPU function
 */

import fc from "fast-check";
import { describe } from "vitest";
import {
  expect,
  skipIfNoWebGPU,
  test,
} from "@/__tests__/webgpu/webgpu-fixture.ts";
import { parseStringStream } from "@/parser/api/string/parseStringStream.ts";

import { parseStringStreamInGPU } from "./parseStringStreamInGPU.ts";

/**
 * Helper to convert string to ReadableStream<string>
 */
function stringToStream(str: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(str);
      controller.close();
    },
  });
}

/**
 * Escape a CSV field if needed (quote if contains comma, newline, or quote)
 */
function escapeField(field: string): string {
  if (
    field.includes(",") ||
    field.includes("\n") ||
    field.includes("\r") ||
    field.includes('"')
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Simple ASCII field generator (no special chars that need escaping)
 */
const simpleFieldArbitrary = fc
  .string({ minLength: 0, maxLength: 10 })
  .filter(
    (s) =>
      !s.includes(",") &&
      !s.includes("\n") &&
      !s.includes("\r") &&
      !s.includes('"'),
  );

/**
 * Simple ASCII header generator (non-empty, unique, no special chars)
 */
const simpleHeaderArbitrary = fc.uniqueArray(
  fc
    .string({ minLength: 1, maxLength: 8 })
    .filter(
      (s) =>
        !s.includes(",") &&
        !s.includes("\n") &&
        !s.includes("\r") &&
        !s.includes('"') &&
        s.trim().length > 0,
    ),
  { minLength: 1, maxLength: 5 },
);

describe("parseStringStreamInGPU", () => {
  // ============================================================
  // Unit Tests
  // ============================================================

  test("should parse simple CSV string stream", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const stream = stringToStream("name,age\nAlice,30\nBob,25");
    const records: Array<{ name: string; age: string }> = [];

    for await (const record of parseStringStreamInGPU(stream)) {
      records.push(record as { name: string; age: string });
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ name: "Alice", age: "30" });
    expect(records[1]).toEqual({ name: "Bob", age: "25" });
  });

  test("should infer header from first row by default", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const stream = stringToStream("col1,col2,col3\na,b,c\n1,2,3");
    const records: Array<Record<string, string>> = [];

    for await (const record of parseStringStreamInGPU(stream)) {
      records.push(record as Record<string, string>);
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toHaveProperty("col1", "a");
    expect(records[0]).toHaveProperty("col2", "b");
    expect(records[0]).toHaveProperty("col3", "c");
  });

  test("should use explicit header when provided", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const stream = stringToStream("Alice,30\nBob,25");
    const records: Array<{ name: string; age: string }> = [];

    for await (const record of parseStringStreamInGPU(stream, {
      header: ["name", "age"] as const,
    })) {
      records.push(record as { name: string; age: string });
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ name: "Alice", age: "30" });
    expect(records[1]).toEqual({ name: "Bob", age: "25" });
  });

  test("should handle quoted fields", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const stream = stringToStream(
      'name,desc\n"Alice","Hello, World"\n"Bob","Test"',
    );
    const records: Array<{ name: string; desc: string }> = [];

    for await (const record of parseStringStreamInGPU(stream)) {
      records.push(record as { name: string; desc: string });
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ name: "Alice", desc: "Hello, World" });
    expect(records[1]).toEqual({ name: "Bob", desc: "Test" });
  });

  test("should handle escaped quotes", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const stream = stringToStream('text\n"He said ""Hello"""');
    const records: Array<{ text: string }> = [];

    for await (const record of parseStringStreamInGPU(stream)) {
      records.push(record as { text: string });
    }

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ text: 'He said "Hello"' });
  });

  test("should return empty for empty input", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const stream = stringToStream("");
    const records: Array<Record<string, string>> = [];

    for await (const record of parseStringStreamInGPU(stream)) {
      records.push(record as Record<string, string>);
    }

    expect(records).toHaveLength(0);
  });

  test("should handle array output format", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const stream = stringToStream("name,age\nAlice,30\nBob,25");
    const records: Array<string[]> = [];

    for await (const record of parseStringStreamInGPU(stream, {
      outputFormat: "array",
    })) {
      records.push(record as unknown as string[]);
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual(["Alice", "30"]);
    expect(records[1]).toEqual(["Bob", "25"]);
  });

  test("should handle multi-chunk string stream", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    // Create a stream that delivers data in multiple chunks
    const chunks = ["name,age\n", "Alice,30\n", "Bob,25"];

    const stream = new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const records: Array<{ name: string; age: string }> = [];

    for await (const record of parseStringStreamInGPU(stream)) {
      records.push(record as { name: string; age: string });
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ name: "Alice", age: "30" });
    expect(records[1]).toEqual({ name: "Bob", age: "25" });
  });

  // ============================================================
  // Property-Based Tests: GPU vs CPU Equivalence
  // ============================================================

  test(
    "PBT: should produce identical results to CPU parser for random CSV string stream",
    { timeout: 60000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          simpleHeaderArbitrary,
          fc.array(
            fc.array(simpleFieldArbitrary, { minLength: 1, maxLength: 5 }),
            {
              minLength: 1,
              maxLength: 20,
            },
          ),
          fc.constantFrom("\n", "\r\n"),
          async (headers, rows, eol) => {
            // Normalize rows to match header length
            const normalizedRows = rows.map((row) =>
              row
                .slice(0, headers.length)
                .concat(
                  Array(Math.max(0, headers.length - row.length)).fill(""),
                ),
            );

            const csvData = [
              headers.map(escapeField).join(","),
              ...normalizedRows.map((r) => r.map(escapeField).join(",")),
            ].join(eol);

            // Parse with GPU
            const gpuRecords: Record<string, string>[] = [];
            for await (const record of parseStringStreamInGPU(
              stringToStream(csvData),
            )) {
              gpuRecords.push(record as Record<string, string>);
            }

            // Parse with CPU
            const cpuRecords: Record<string, string>[] = [];
            for await (const record of parseStringStream(
              stringToStream(csvData),
            )) {
              cpuRecords.push(record as Record<string, string>);
            }

            // Compare
            expect(gpuRecords.length).toBe(cpuRecords.length);
            for (let i = 0; i < gpuRecords.length; i++) {
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 30 },
      );
    },
  );

  test(
    "PBT: should handle various line endings correctly",
    { timeout: 60000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          simpleHeaderArbitrary,
          fc.array(
            fc.array(simpleFieldArbitrary, { minLength: 1, maxLength: 3 }),
            {
              minLength: 1,
              maxLength: 10,
            },
          ),
          fc.constantFrom("\n", "\r\n"),
          async (headers, rows, eol) => {
            const normalizedRows = rows.map((row) =>
              row
                .slice(0, headers.length)
                .concat(
                  Array(Math.max(0, headers.length - row.length)).fill(""),
                ),
            );

            const csvData = [
              headers.map(escapeField).join(","),
              ...normalizedRows.map((r) => r.map(escapeField).join(",")),
            ].join(eol);

            // Parse with GPU
            const gpuRecords: Record<string, string>[] = [];
            for await (const record of parseStringStreamInGPU(
              stringToStream(csvData),
            )) {
              gpuRecords.push(record as Record<string, string>);
            }

            // Parse with CPU
            const cpuRecords: Record<string, string>[] = [];
            for await (const record of parseStringStream(
              stringToStream(csvData),
            )) {
              cpuRecords.push(record as Record<string, string>);
            }

            // Compare
            expect(gpuRecords.length).toBe(cpuRecords.length);
            for (let i = 0; i < gpuRecords.length; i++) {
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 20 },
      );
    },
  );
});
