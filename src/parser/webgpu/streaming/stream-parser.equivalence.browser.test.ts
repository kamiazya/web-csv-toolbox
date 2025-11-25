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
import type { CSVRecord } from "../indexing/types.ts";
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
 * Generator for long quoted fields (>256 bytes) to test two-pass algorithm
 * These fields span multiple workgroups and verify cross-workgroup quote propagation
 */
const longQuotedFieldArbitrary = fc.oneof(
  // Long text without special chars (300-600 bytes)
  fc
    .string({ minLength: 300, maxLength: 600 })
    .filter((s) => !s.includes('"'))
    .map((s) => `"${s}"`),
  // Long text with embedded commas (tests comma masking across workgroups)
  fc
    .array(
      fc
        .string({ minLength: 5, maxLength: 20 })
        .filter((s) => !s.includes('"') && !s.includes(",")),
      { minLength: 20, maxLength: 40 },
    )
    .map((parts) => `"${parts.join(", ")}"`),
  // Long text with embedded newlines (tests newline masking across workgroups)
  fc
    .array(
      fc
        .string({ minLength: 10, maxLength: 30 })
        .filter(
          (s) => !s.includes('"') && !s.includes("\n") && !s.includes("\r"),
        ),
      { minLength: 15, maxLength: 25 },
    )
    .map((lines) => `"${lines.join("\n")}"`),
  // Long text with embedded quotes (tests quote escaping in long fields)
  fc
    .array(
      fc
        .string({ minLength: 5, maxLength: 15 })
        .filter((s) => !s.includes('"')),
      { minLength: 20, maxLength: 30 },
    )
    .map((parts) => `"${parts.join('" said "')}"`),
);

/**
 * Generator for CSV records that include at least one long quoted field
 */
const csvRecordWithLongFieldArbitrary = fc
  .tuple(
    fc.array(csvFieldArbitrary, { minLength: 0, maxLength: 3 }),
    longQuotedFieldArbitrary,
    fc.array(csvFieldArbitrary, { minLength: 0, maxLength: 3 }),
  )
  .map(([before, long, after]) => [...before, long, ...after]);

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
              { header: [], outputFormat: "array", skipEmptyLines: false },
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
                { header: [], outputFormat: "array", skipEmptyLines: false },
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
                { header: [], outputFormat: "array", skipEmptyLines: false },
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
          skipEmptyLines: false,
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

    it.skipIf(!navigator.gpu)(
      "should handle long quoted fields spanning multiple workgroups (>256 bytes)",
      { timeout: 120000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(csvRecordWithLongFieldArbitrary, {
              minLength: 1,
              maxLength: 10,
            }),
            async (records) => {
              const csvData = records
                .map((fields) => fields.join(","))
                .join("\n");

              // Skip if empty
              if (csvData.trim().length === 0) {
                return true;
              }

              // Parse with WebGPU
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

              // Parse with CPU
              const cpuRecords: string[][] = [];
              for await (const record of parseStringStream(
                stringToStream(csvData),
                { header: [], outputFormat: "array", skipEmptyLines: false },
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
          { numRuns: 30, verbose: true },
        );
      },
    );

    it.skipIf(!navigator.gpu)(
      "should handle specific workgroup boundary cases",
      { timeout: 60000 },
      async () => {
        // These are deterministic test cases that specifically target workgroup boundaries
        const workgroupBoundaryCases = [
          // Case 1: Quoted field exactly at 256-byte boundary
          `name,data\n"Alice","${"x".repeat(250)}"\n"Bob","short"`,
          // Case 2: Quoted field crossing single workgroup boundary (300 bytes)
          `name,description\n"Test","${"a".repeat(300)}"\n"End","final"`,
          // Case 3: Quoted field with commas crossing boundary
          `f1,f2\n"${"data, ".repeat(60)}"\n"end","ok"`,
          // Case 4: Quoted field with newlines crossing boundary
          `f1,f2\n"${"line\n".repeat(80)}"\n"end","ok"`,
          // Case 5: Multiple long quoted fields in same row
          `f1,f2,f3\n"${"a".repeat(300)}","${"b".repeat(300)}","${"c".repeat(300)}"`,
          // Case 6: Alternating long and short fields
          `f1,f2,f3,f4\n"${"x".repeat(300)}",plain1,"${"y".repeat(300)}",plain2`,
          // Case 7: Quoted field with escaped quotes crossing boundary
          `f1,f2\n"${'value ""quoted"" '.repeat(40)}"\n"end","ok"`,
          // Case 8: Very long field (>1KB, multiple workgroups)
          `name,content\n"Test","${"z".repeat(1200)}"\n"Done","yes"`,
        ];

        for (const csvData of workgroupBoundaryCases) {
          // Parse with WebGPU
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

          // Parse with CPU
          const cpuRecords: string[][] = [];
          for await (const record of parseStringStream(
            stringToStream(csvData),
            {
              header: [],
              outputFormat: "array",
              skipEmptyLines: false,
            },
          )) {
            cpuRecords.push(normalizeStandardRecord(record));
          }

          // Compare with detailed error message
          expect(
            gpuRecords.length,
            `Record count mismatch for: ${csvData.substring(0, 100)}...`,
          ).toBe(cpuRecords.length);
          for (let i = 0; i < gpuRecords.length; i++) {
            expect(gpuRecords[i], `Record ${i} mismatch`).toEqual(
              cpuRecords[i],
            );
          }
        }
      },
    );

    it.skipIf(!navigator.gpu)(
      "should handle chunks without complete records (prevInQuote edge case)",
      { timeout: 60000 },
      async () => {
        // Test streaming with chunks that don't contain complete records
        // This exercises the prevInQuote handling when processedBytesCount === 0

        const testCases = [
          // Case 1: Very long single field that spans multiple chunk reads
          `"${"x".repeat(2000)}"`,
          // Case 2: Row without newline (incomplete record until finalize)
          `a,b,c`,
          // Case 3: Long quoted field followed by data
          `"${"long content ".repeat(200)}",short\nrow2,data`,
        ];

        for (const csvData of testCases) {
          // Parse with WebGPU using small simulated chunks
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

          // Parse with CPU
          const cpuRecords: string[][] = [];
          for await (const record of parseStringStream(
            stringToStream(csvData),
            {
              header: [],
              outputFormat: "array",
              skipEmptyLines: false,
            },
          )) {
            cpuRecords.push(normalizeStandardRecord(record));
          }

          // Compare
          expect(gpuRecords.length).toBe(cpuRecords.length);
          for (let i = 0; i < gpuRecords.length; i++) {
            expect(gpuRecords[i]).toEqual(cpuRecords[i]);
          }
        }
      },
    );

    it.skipIf(!navigator.gpu)(
      "should correctly unescape doubled quotes in long fields",
      { timeout: 60000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .array(
                fc
                  .string({ minLength: 5, maxLength: 20 })
                  .filter((s) => !s.includes('"')),
                { minLength: 20, maxLength: 40 },
              )
              .map((parts) => parts.join('""')),
            async (contentWithQuotes) => {
              // Create a long quoted field with escaped quotes
              const csvData = `field\n"${contentWithQuotes}"`;

              // Parse with WebGPU
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

              // Parse with CPU
              const cpuRecords: string[][] = [];
              for await (const record of parseStringStream(
                stringToStream(csvData),
                { header: [], outputFormat: "array", skipEmptyLines: false },
              )) {
                cpuRecords.push(normalizeStandardRecord(record));
              }

              // Compare - the key is that "" should be unescaped to "
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
});
