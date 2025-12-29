/**
 * Integration test for parseString with GPU execution
 *
 * Tests that the public parseString API correctly routes to WebGPU
 * when EnginePresets.turbo() is used.
 */

import { describe } from "vitest";

import { EnginePresets, parseString } from "@/main.shared.ts";

import { expect, skipIfNoWebGPU, test } from "./webgpu-fixture.ts";

describe("parseString with EnginePresets.turbo()", () => {
  test("should parse simple CSV via GPU", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    // Make navigator.gpu available
    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const csv = "name,age\nAlice,30\nBob,25";
    const records: Array<{ name: string; age: string }> = [];

    for await (const record of parseString(csv, {
      engine: EnginePresets.turbo(),
    })) {
      records.push(record as { name: string; age: string });
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ name: "Alice", age: "30" });
    expect(records[1]).toEqual({ name: "Bob", age: "25" });
  });

  test("should handle quoted fields via GPU", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const csv = 'name,description\n"Alice","Hello, World"\n"Bob","Test"';
    const records: Array<{ name: string; description: string }> = [];

    for await (const record of parseString(csv, {
      engine: EnginePresets.turbo(),
    })) {
      records.push(record as { name: string; description: string });
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ name: "Alice", description: "Hello, World" });
    expect(records[1]).toEqual({ name: "Bob", description: "Test" });
  });

  test("should handle escaped quotes via GPU", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const csv = 'text\n"He said ""Hello"""';
    const records: Array<{ text: string }> = [];

    for await (const record of parseString(csv, {
      engine: EnginePresets.turbo(),
    })) {
      records.push(record as { text: string });
    }

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ text: 'He said "Hello"' });
  });

  test("should handle long quoted fields (two-pass algorithm) via GPU", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const longText = "x".repeat(300);
    const csv = `name,data\n"Test","${longText}"\n"End","short"`;
    const records: Array<{ name: string; data: string }> = [];

    for await (const record of parseString(csv, {
      engine: EnginePresets.turbo(),
    })) {
      records.push(record as { name: string; data: string });
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ name: "Test", data: longText });
    expect(records[1]).toEqual({ name: "End", data: "short" });
  });

  test("should not skip rows on medium CSV via GPU (regression)", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const rows = 200;
    const cols = 10;
    const lines: string[] = [];

    lines.push(Array.from({ length: cols }, (_, i) => `col${i}`).join(","));

    for (let i = 0; i < rows; i++) {
      const row = Array.from({ length: cols }, (_, j) => {
        const needsComma = (i * 10 + j) % 2 === 0;
        const value = needsComma ? `val${i}_${j},data` : `val${i}_${j}`;
        return value.includes(",") ? `"${value}"` : value;
      });
      lines.push(row.join(","));
    }

    let csv = lines.join("\r\n");
    if (!csv.endsWith("\r\n")) {
      csv += "\r\n";
    }

    // Run multiple times to catch nondeterministic separator dropping.
    for (let trial = 0; trial < 10; trial++) {
      const records: Array<Record<string, string>> = [];
      for await (const record of parseString(csv, {
        engine: EnginePresets.turbo(),
        maxBufferSize: Number.POSITIVE_INFINITY,
      })) {
        records.push(record as Record<string, string>);
      }

      expect(records).toHaveLength(rows);
      for (let i = 0; i < rows; i++) {
        expect(records[i]?.col0).toBe(`val${i}_0,data`);
      }
    }
  });
});
