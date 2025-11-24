/**
 * Property-Based Testing: WebGPU Parser vs CPU Parser Equivalence
 *
 * This test suite verifies that the WebGPU-accelerated parser produces
 * identical results to the standard CPU-based parser across a wide range
 * of randomly generated CSV inputs.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseStringStream } from "@/parser/api/string/parseStringStream.ts";
import type { CSVRecord } from "../core/types.ts";
import { StreamParser } from "./stream-parser.ts";

/**
 * Converts a string into a ReadableStream
 */
function stringToStream(data: string): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

/**
 * Converts a string into a ReadableStream<Uint8Array>
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
 * Custom CSV field generator that produces valid CSV field content
 */
const csvFieldArbitrary = fc.oneof(
  // Simple strings without special characters
  fc
    .string({ minLength: 0, maxLength: 20 })
    .filter((s) => {
      return (
        !s.includes(",") &&
        !s.includes("\n") &&
        !s.includes("\r") &&
        !s.includes('"')
      );
    }),
  // Quoted fields with possible internal quotes
  fc
    .string({ minLength: 0, maxLength: 15 })
    .map((s) => `"${s.replace(/"/g, '""')}"`),
  // Numbers
  fc
    .integer()
    .map(String),
  // Empty fields
  fc.constant(""),
);

/**
 * Generates a CSV record (row) as an array of fields
 */
const csvRecordArbitrary = fc.array(csvFieldArbitrary, {
  minLength: 1,
  maxLength: 10,
});

/**
 * Generates a complete CSV dataset
 */
const csvDatasetArbitrary = fc
  .array(csvRecordArbitrary, {
    minLength: 0,
    maxLength: 100,
  })
  .map((records) => {
    // Convert records to CSV string
    return records.map((fields) => fields.join(",")).join("\n");
  });

/**
 * Normalizes a CSVRecord for comparison
 */
function normalizeRecord(record: CSVRecord): string[] {
  return record.fields.map((field) => field.value);
}

/**
 * Normalizes a standard parser record for comparison
 */
function normalizeStandardRecord(
  record: Record<string, string> | string[] | readonly string[],
): string[] {
  if (Array.isArray(record)) {
    return [...record]; // Convert readonly array to mutable array
  }
  return Object.values(record);
}

describe("WebGPU Parser Equivalence Tests", () => {
  describe("Property-Based Testing: WebGPU vs CPU", () => {
    it.skipIf(!navigator.gpu)(
      "should produce identical results to CPU parser for random CSV inputs",
      { timeout: 60000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(csvDatasetArbitrary, async (csvData) => {
            // Skip empty inputs
            if (csvData.trim().length === 0) {
              return true;
            }

            // Parse with WebGPU (low-level API returns all rows)
            const gpuRecords: string[][] = [];
            const gpuParser = new StreamParser({
              onRecord: (record) => {
                gpuRecords.push(normalizeRecord(record));
              },
            });

            try {
              await gpuParser.initialize();
              await gpuParser.parseStream(stringToBinaryStream(csvData));
              await gpuParser.destroy();
            } catch (error) {
              // If GPU initialization fails, skip this test
              if (
                error instanceof Error &&
                (error.message.includes("WebGPU") ||
                  error.message.includes("GPU adapter") ||
                  error.message.includes("GPU device"))
              ) {
                return true;
              }
              throw error;
            }

            // Parse with CPU (use header: [] with outputFormat: 'array' to return all rows like GPU)
            const cpuRecords: string[][] = [];
            for await (const record of parseStringStream(
              stringToStream(csvData),
              { header: [], outputFormat: "array" },
            )) {
              cpuRecords.push(normalizeStandardRecord(record));
            }

            // Compare results
            expect(gpuRecords.length).toBe(cpuRecords.length);
            for (let i = 0; i < gpuRecords.length; i++) {
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          }),
          {
            numRuns: 50, // Run 50 random tests
            verbose: true,
          },
        );
      },
    );

    it.skipIf(!navigator.gpu)(
      "should handle CSV with headers correctly",
      { timeout: 60000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(csvFieldArbitrary, { minLength: 1, maxLength: 5 }),
            fc.array(csvRecordArbitrary, { minLength: 0, maxLength: 20 }),
            async (headers, dataRows) => {
              const csvData = [
                headers.join(","),
                ...dataRows.map((row) => row.join(",")),
              ].join("\n");

              // Parse with WebGPU (low-level API returns all rows)
              const gpuRecords: string[][] = [];
              const gpuParser = new StreamParser({
                onRecord: (record) => {
                  gpuRecords.push(normalizeRecord(record));
                },
              });

              try {
                await gpuParser.initialize();
                await gpuParser.parseStream(stringToBinaryStream(csvData));
                await gpuParser.destroy();
              } catch (error) {
                if (
                  error instanceof Error &&
                  (error.message.includes("WebGPU") ||
                    error.message.includes("GPU adapter") ||
                    error.message.includes("GPU device"))
                ) {
                  return true;
                }
                throw error;
              }

              // Parse with CPU (use header: [] with outputFormat: 'array' to return all rows like GPU)
              const cpuRecords: string[][] = [];
              for await (const record of parseStringStream(
                stringToStream(csvData),
                { header: [], outputFormat: "array" },
              )) {
                cpuRecords.push(normalizeStandardRecord(record));
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

    it.skipIf(!navigator.gpu)(
      "should handle various line endings correctly",
      { timeout: 60000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(csvRecordArbitrary, { minLength: 1, maxLength: 20 }),
            fc.constantFrom("\n", "\r\n"),
            async (records, lineEnding) => {
              const csvData = records
                .map((fields) => fields.join(","))
                .join(lineEnding);

              // Parse with WebGPU (low-level API returns all rows)
              const gpuRecords: string[][] = [];
              const gpuParser = new StreamParser({
                onRecord: (record) => {
                  gpuRecords.push(normalizeRecord(record));
                },
              });

              try {
                await gpuParser.initialize();
                await gpuParser.parseStream(stringToBinaryStream(csvData));
                await gpuParser.destroy();
              } catch (error) {
                if (
                  error instanceof Error &&
                  (error.message.includes("WebGPU") ||
                    error.message.includes("GPU adapter") ||
                    error.message.includes("GPU device"))
                ) {
                  return true;
                }
                throw error;
              }

              // Parse with CPU (use header: [] with outputFormat: 'array' to return all rows like GPU)
              const cpuRecords: string[][] = [];
              for await (const record of parseStringStream(
                stringToStream(csvData),
                { header: [], outputFormat: "array" },
              )) {
                cpuRecords.push(normalizeStandardRecord(record));
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

    it.skipIf(!navigator.gpu)("should handle edge cases", async () => {
      const edgeCases = [
        // Single field
        "value",
        // Single row with multiple fields
        "a,b,c",
        // Multiple rows
        "a,b,c\n1,2,3\n4,5,6",
        // Quoted fields
        '"hello","world"',
        // Quoted fields with commas
        '"hello, world","foo"',
        // Quoted fields with internal quotes
        '"hello ""world""","foo"',
        // Empty fields
        "a,,c\n,b,\n,,",
        // Mixed quoted and unquoted
        'a,"b",c\n1,"2",3',
        // Trailing newline
        "a,b,c\n1,2,3\n",
      ];

      for (const csvData of edgeCases) {
        if (csvData.trim().length === 0) {
          continue; // Skip empty cases
        }

        // Parse with WebGPU (low-level API returns all rows)
        const gpuRecords: string[][] = [];
        const gpuParser = new StreamParser({
          onRecord: (record) => {
            gpuRecords.push(normalizeRecord(record));
          },
        });

        try {
          await gpuParser.initialize();
          await gpuParser.parseStream(stringToBinaryStream(csvData));
          await gpuParser.destroy();
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message.includes("WebGPU") ||
              error.message.includes("GPU adapter") ||
              error.message.includes("GPU device"))
          ) {
            continue;
          }
          throw error;
        }

        // Parse with CPU (use header: [] with outputFormat: 'array' to return all rows like GPU)
        const cpuRecords: string[][] = [];
        for await (const record of parseStringStream(stringToStream(csvData), {
          header: [],
          outputFormat: "array",
        })) {
          cpuRecords.push(normalizeStandardRecord(record));
        }

        // Compare
        expect(gpuRecords.length).toBe(cpuRecords.length);
        for (let i = 0; i < gpuRecords.length; i++) {
          expect(gpuRecords[i]).toEqual(cpuRecords[i]);
        }
      }
    });
  });
});
