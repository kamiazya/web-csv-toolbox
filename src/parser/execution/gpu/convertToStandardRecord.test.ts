/**
 * Tests for convertToStandardRecord function
 */

import fc from "fast-check";
import { describe, expect, test } from "vitest";

import { FC } from "@/__tests__/helper.ts";
import type { CSVRecord as WebGPUCSVRecord } from "@/parser/webgpu/indexing/types.ts";

import { convertToStandardRecord } from "./convertToStandardRecord.ts";

describe("convertToStandardRecord", () => {
  // ============================================================
  // Unit Tests
  // ============================================================

  test("should convert to object format with header", () => {
    const gpuRecord: WebGPUCSVRecord = {
      fields: [
        { start: 0, end: 5, value: "Alice" },
        { start: 6, end: 8, value: "30" },
      ],
      recordIndex: 0,
    };

    const result = convertToStandardRecord(
      gpuRecord,
      ["name", "age"] as const,
      "object",
    );

    expect(result).toEqual({ name: "Alice", age: "30" });
  });

  test("should convert to array format", () => {
    const gpuRecord: WebGPUCSVRecord = {
      fields: [
        { start: 0, end: 5, value: "Alice" },
        { start: 6, end: 8, value: "30" },
      ],
      recordIndex: 0,
    };

    const result = convertToStandardRecord(gpuRecord, undefined, "array");

    expect(result).toEqual(["Alice", "30"]);
  });

  test("should handle empty fields with object format", () => {
    const gpuRecord: WebGPUCSVRecord = {
      fields: [
        { start: 0, end: 5, value: "Alice" },
        { start: 6, end: 6, value: "" },
        { start: 7, end: 9, value: "30" },
      ],
      recordIndex: 0,
    };

    const result = convertToStandardRecord(
      gpuRecord,
      ["name", "city", "age"] as const,
      "object",
    );

    expect(result).toEqual({ name: "Alice", city: "", age: "30" });
  });

  test("should handle missing values (less fields than headers)", () => {
    const gpuRecord: WebGPUCSVRecord = {
      fields: [{ start: 0, end: 5, value: "Alice" }],
      recordIndex: 0,
    };

    const result = convertToStandardRecord(
      gpuRecord,
      ["name", "age"] as const,
      "object",
    );

    expect(result).toEqual({ name: "Alice", age: "" });
  });

  test("should throw error for object format without header", () => {
    const gpuRecord: WebGPUCSVRecord = {
      fields: [{ start: 0, end: 5, value: "Alice" }],
      recordIndex: 0,
    };

    expect(() => {
      convertToStandardRecord(gpuRecord, undefined, "object");
    }).toThrow("Header is required for object output format");
  });

  test("should default to object format", () => {
    const gpuRecord: WebGPUCSVRecord = {
      fields: [{ start: 0, end: 5, value: "Alice" }],
      recordIndex: 0,
    };

    const result = convertToStandardRecord(gpuRecord, ["name"] as const);

    expect(result).toEqual({ name: "Alice" });
  });

  // ============================================================
  // Property-Based Tests
  // ============================================================

  test("PBT: should correctly convert any field values to object format", () => {
    fc.assert(
      fc.property(
        FC.header({ columnsConstraints: { minLength: 1, maxLength: 10 } }),
        FC.row({
          columnsConstraints: { minLength: 1, maxLength: 10 },
        }),
        (headers, values) => {
          // Create WebGPU record with fields matching values length
          const gpuRecord: WebGPUCSVRecord = {
            fields: values.map((value, i) => ({
              start: i * 10,
              end: i * 10 + (value?.length ?? 0),
              value: value ?? "",
            })),
            recordIndex: 0,
          };

          // Use matching number of headers
          const usedHeaders = headers.slice(0, values.length);
          if (usedHeaders.length === 0) {
            return true; // Skip empty case
          }

          const result = convertToStandardRecord(
            gpuRecord,
            usedHeaders as readonly string[],
            "object",
          );

          // Verify each header key has the correct value
          for (let i = 0; i < usedHeaders.length; i++) {
            expect(result).toHaveProperty(usedHeaders[i]!, values[i] ?? "");
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  test("PBT: should correctly convert any field values to array format", () => {
    fc.assert(
      fc.property(
        FC.row({
          columnsConstraints: { minLength: 1, maxLength: 10 },
        }),
        (values) => {
          const gpuRecord: WebGPUCSVRecord = {
            fields: values.map((value, i) => ({
              start: i * 10,
              end: i * 10 + (value?.length ?? 0),
              value: value ?? "",
            })),
            recordIndex: 0,
          };

          const result = convertToStandardRecord(gpuRecord, undefined, "array");

          // Result should be an array with the same values
          expect(result).toEqual(values.map((v) => v ?? ""));

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  test("PBT: array format should work without header", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 20 }),
        (values) => {
          const gpuRecord: WebGPUCSVRecord = {
            fields: values.map((value, i) => ({
              start: i * 10,
              end: i * 10 + value.length,
              value,
            })),
            recordIndex: 0,
          };

          // Should not throw even without header
          const result = convertToStandardRecord(gpuRecord, undefined, "array");
          expect(result).toEqual(values);

          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  test("PBT: object format should fill missing values with empty string", () => {
    fc.assert(
      fc.property(
        FC.header({ columnsConstraints: { minLength: 2, maxLength: 10 } }),
        fc.integer({ min: 1, max: 5 }),
        (headers, numFields) => {
          // Create a record with fewer fields than headers
          const actualFieldCount = Math.min(numFields, headers.length - 1);
          if (actualFieldCount < 1) {
            return true; // Skip invalid cases
          }

          const gpuRecord: WebGPUCSVRecord = {
            fields: Array.from({ length: actualFieldCount }, (_, i) => ({
              start: i * 10,
              end: i * 10 + 5,
              value: `val${i}`,
            })),
            recordIndex: 0,
          };

          const result = convertToStandardRecord(
            gpuRecord,
            headers as readonly string[],
            "object",
          );

          // Verify missing fields are empty strings
          for (let i = actualFieldCount; i < headers.length; i++) {
            expect(result).toHaveProperty(headers[i]!, "");
          }

          return true;
        },
      ),
      { numRuns: 50 },
    );
  });
});
