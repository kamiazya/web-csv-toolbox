/**
 * Property-Based Tests: All Parser Implementations Equivalence
 *
 * Verifies that all parser implementations (JS/CPU, WASM, GPU) produce
 * identical results for random CSV inputs.
 *
 * This is a critical property test that ensures:
 * - GPU parser matches CPU parser
 * - WASM parser matches CPU parser
 * - All three produce identical token streams and parsed records
 */

import fc from "fast-check";
import { describe } from "vitest";
import {
  expect,
  skipIfNoWebGPU,
  test,
} from "@/__tests__/webgpu/webgpu-fixture.ts";
import { parseBinaryStream } from "@/parser/api/binary/parseBinaryStream.ts";
import { parseBinaryStreamInGPU } from "@/parser/execution/gpu/parseBinaryStreamInGPU.ts";

/**
 * Helper to convert string to ReadableStream
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

/**
 * Escape a CSV field if needed
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
 * Simple ASCII field generator (no special chars)
 */
const simpleFieldArbitrary = fc
  .string({ minLength: 0, maxLength: 50 })
  .filter(
    (s) =>
      !s.includes(",") &&
      !s.includes("\n") &&
      !s.includes("\r") &&
      !s.includes('"'),
  );

/**
 * Complex field generator (with special characters)
 */
const complexFieldArbitrary = fc.string({ minLength: 0, maxLength: 100 });

/**
 * Unicode field generator (multibyte characters)
 */
const unicodeFieldArbitrary = fc.string({
  minLength: 0,
  maxLength: 30,
}).filter((s) => !s.includes(",") && !s.includes("\n") && !s.includes("\r"));

/**
 * Header generator (unique, non-empty strings)
 */
const headerArbitrary = fc.uniqueArray(
  fc
    .string({ minLength: 1, maxLength: 20 })
    .filter(
      (s) =>
        !s.includes(",") &&
        !s.includes("\n") &&
        !s.includes("\r") &&
        !s.includes('"') &&
        s.trim().length > 0,
    ),
  { minLength: 1, maxLength: 20 },
);

describe("All Parser Implementations Equivalence (JS/CPU, WASM, GPU)", () => {
  test(
    "PBT: All parsers produce identical results for simple CSV",
    { timeout: 180000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          headerArbitrary,
          fc.array(
            fc.array(simpleFieldArbitrary, { minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 100 },
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

            // Parse with JS/CPU (no WASM, no GPU)
            const cpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: false, gpu: false } },
            )) {
              cpuRecords.push(record as Record<string, string>);
            }

            // Parse with WASM
            const wasmRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: true, gpu: false } },
            )) {
              wasmRecords.push(record as Record<string, string>);
            }

            // Parse with GPU
            const gpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStreamInGPU(
              stringToStream(csvData),
            )) {
              gpuRecords.push(record as Record<string, string>);
            }

            // All parsers should produce same number of records
            expect(wasmRecords.length).toBe(cpuRecords.length);
            expect(gpuRecords.length).toBe(cpuRecords.length);

            // Compare each record
            for (let i = 0; i < cpuRecords.length; i++) {
              // WASM should match CPU
              expect(wasmRecords[i]).toEqual(cpuRecords[i]);
              // GPU should match CPU
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 150, endOnFailure: true },
      );
    },
  );

  test(
    "PBT: All parsers handle complex fields identically",
    { timeout: 180000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          headerArbitrary,
          fc.array(
            fc.array(complexFieldArbitrary, { minLength: 1, maxLength: 10 }),
            { minLength: 1, maxLength: 50 },
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

            // JS/CPU
            const cpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: false, gpu: false } },
            )) {
              cpuRecords.push(record as Record<string, string>);
            }

            // WASM
            const wasmRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: true, gpu: false } },
            )) {
              wasmRecords.push(record as Record<string, string>);
            }

            // GPU
            const gpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStreamInGPU(
              stringToStream(csvData),
            )) {
              gpuRecords.push(record as Record<string, string>);
            }

            expect(wasmRecords.length).toBe(cpuRecords.length);
            expect(gpuRecords.length).toBe(cpuRecords.length);

            for (let i = 0; i < cpuRecords.length; i++) {
              expect(wasmRecords[i]).toEqual(cpuRecords[i]);
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 100, endOnFailure: true },
      );
    },
  );

  test(
    "PBT: All parsers handle array output format identically",
    { timeout: 180000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          headerArbitrary,
          fc.array(
            fc.array(simpleFieldArbitrary, { minLength: 1, maxLength: 15 }),
            { minLength: 1, maxLength: 80 },
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

            // JS/CPU with array output
            const cpuRecords: string[][] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: false, gpu: false }, outputFormat: "array" },
            )) {
              cpuRecords.push(record as unknown as string[]);
            }

            // WASM with array output
            const wasmRecords: string[][] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: true, gpu: false }, outputFormat: "array" },
            )) {
              wasmRecords.push(record as unknown as string[]);
            }

            // GPU with array output
            const gpuRecords: string[][] = [];
            for await (const record of parseBinaryStreamInGPU(
              stringToStream(csvData),
              { outputFormat: "array" },
            )) {
              gpuRecords.push(record as unknown as string[]);
            }

            expect(wasmRecords.length).toBe(cpuRecords.length);
            expect(gpuRecords.length).toBe(cpuRecords.length);

            for (let i = 0; i < cpuRecords.length; i++) {
              expect(wasmRecords[i]).toEqual(cpuRecords[i]);
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 120, endOnFailure: true },
      );
    },
  );

  test(
    "PBT: All parsers handle headerless mode identically",
    { timeout: 180000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 15 }), // number of columns
          fc.array(
            fc.array(simpleFieldArbitrary, { minLength: 1, maxLength: 15 }),
            { minLength: 1, maxLength: 60 },
          ),
          fc.constantFrom("\n", "\r\n"),
          async (numCols, rows, eol) => {
            const normalizedRows = rows.map((row) =>
              row
                .slice(0, numCols)
                .concat(Array(Math.max(0, numCols - row.length)).fill("")),
            );

            // No header row - all rows are data
            const csvData = normalizedRows
              .map((r) => r.map(escapeField).join(","))
              .join(eol);

            // JS/CPU headerless
            const cpuRecords: string[][] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              {
                engine: { wasm: false, gpu: false },
                header: [] as const,
                outputFormat: "array",
              },
            )) {
              cpuRecords.push(record as unknown as string[]);
            }

            // WASM headerless
            const wasmRecords: string[][] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              {
                engine: { wasm: true, gpu: false },
                header: [] as const,
                outputFormat: "array",
              },
            )) {
              wasmRecords.push(record as unknown as string[]);
            }

            // GPU headerless
            const gpuRecords: string[][] = [];
            for await (const record of parseBinaryStreamInGPU(
              stringToStream(csvData),
              { header: [] as const, outputFormat: "array" },
            )) {
              gpuRecords.push(record as unknown as string[]);
            }

            // All should have same number of records (no header consumed)
            expect(wasmRecords.length).toBe(cpuRecords.length);
            expect(gpuRecords.length).toBe(cpuRecords.length);

            for (let i = 0; i < cpuRecords.length; i++) {
              expect(wasmRecords[i]).toEqual(cpuRecords[i]);
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 100, endOnFailure: true },
      );
    },
  );

  test(
    "PBT: All parsers handle edge cases identically (empty fields, quotes)",
    { timeout: 180000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 2, max: 30 }),
          fc.constantFrom("\n", "\r\n"),
          async (numCols, numRows, eol) => {
            // Edge case fields: empty, single char, quotes, special chars
            const edgeCaseFields = [
              "",
              "a",
              '""',
              '"x"',
              "x,y",
              "x\ny",
              '"""',
              '""""',
              "   ",
              "\t",
              "日本語",
              "🎉",
            ];
            const rows = fc.sample(
              fc.array(fc.constantFrom(...edgeCaseFields), {
                minLength: numCols,
                maxLength: numCols,
              }),
              numRows,
            );

            const csvData = rows.map((r) => r.map(escapeField).join(",")).join(eol);

            // JS/CPU
            const cpuRecords: string[][] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              {
                engine: { wasm: false, gpu: false },
                header: [] as const,
                outputFormat: "array",
              },
            )) {
              cpuRecords.push(record as unknown as string[]);
            }

            // WASM
            const wasmRecords: string[][] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              {
                engine: { wasm: true, gpu: false },
                header: [] as const,
                outputFormat: "array",
              },
            )) {
              wasmRecords.push(record as unknown as string[]);
            }

            // GPU
            const gpuRecords: string[][] = [];
            for await (const record of parseBinaryStreamInGPU(
              stringToStream(csvData),
              { header: [] as const, outputFormat: "array" },
            )) {
              gpuRecords.push(record as unknown as string[]);
            }

            expect(wasmRecords.length).toBe(cpuRecords.length);
            expect(gpuRecords.length).toBe(cpuRecords.length);

            for (let i = 0; i < cpuRecords.length; i++) {
              expect(wasmRecords[i]).toEqual(cpuRecords[i]);
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 80, endOnFailure: true },
      );
    },
  );

  test(
    "PBT: All parsers handle empty rows identically",
    { timeout: 180000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          headerArbitrary,
          fc.array(
            fc.oneof(
              fc.array(simpleFieldArbitrary, { minLength: 1, maxLength: 10 }),
              fc.constant([]), // Empty row
            ),
            { minLength: 5, maxLength: 30 },
          ),
          fc.constantFrom("\n", "\r\n"),
          async (headers, rows, eol) => {
            const normalizedRows = rows.map((row) => {
              if (row.length === 0) return Array(headers.length).fill("");
              return row
                .slice(0, headers.length)
                .concat(
                  Array(Math.max(0, headers.length - row.length)).fill(""),
                );
            });

            const csvData = [
              headers.map(escapeField).join(","),
              ...normalizedRows.map((r) => r.map(escapeField).join(",")),
            ].join(eol);

            // JS/CPU
            const cpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: false, gpu: false } },
            )) {
              cpuRecords.push(record as Record<string, string>);
            }

            // WASM
            const wasmRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: true, gpu: false } },
            )) {
              wasmRecords.push(record as Record<string, string>);
            }

            // GPU
            const gpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStreamInGPU(
              stringToStream(csvData),
            )) {
              gpuRecords.push(record as Record<string, string>);
            }

            expect(wasmRecords.length).toBe(cpuRecords.length);
            expect(gpuRecords.length).toBe(cpuRecords.length);

            for (let i = 0; i < cpuRecords.length; i++) {
              expect(wasmRecords[i]).toEqual(cpuRecords[i]);
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 100, endOnFailure: true },
      );
    },
  );

  test(
    "PBT: All parsers handle Unicode/multibyte characters identically",
    { timeout: 180000 },
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          headerArbitrary,
          fc.array(
            fc.array(unicodeFieldArbitrary, { minLength: 1, maxLength: 8 }),
            { minLength: 1, maxLength: 40 },
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

            // JS/CPU
            const cpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: false, gpu: false } },
            )) {
              cpuRecords.push(record as Record<string, string>);
            }

            // WASM
            const wasmRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: true, gpu: false } },
            )) {
              wasmRecords.push(record as Record<string, string>);
            }

            // GPU
            const gpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStreamInGPU(
              stringToStream(csvData),
            )) {
              gpuRecords.push(record as Record<string, string>);
            }

            expect(wasmRecords.length).toBe(cpuRecords.length);
            expect(gpuRecords.length).toBe(cpuRecords.length);

            for (let i = 0; i < cpuRecords.length; i++) {
              expect(wasmRecords[i]).toEqual(cpuRecords[i]);
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 80, endOnFailure: true },
      );
    },
  );

  test(
    "PBT: All parsers handle large datasets identically",
    { timeout: 300000 }, // 5 minutes timeout for large data
    async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu },
        writable: true,
        configurable: true,
      });

      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter(
                (s) =>
                  !s.includes(",") &&
                  !s.includes("\n") &&
                  !s.includes("\r") &&
                  !s.includes('"') &&
                  s.trim().length > 0,
              ),
            { minLength: 15, maxLength: 30 }, // Large number of columns
          ),
          fc.array(
            fc.array(simpleFieldArbitrary, { minLength: 15, maxLength: 30 }),
            { minLength: 100, maxLength: 200 }, // Large number of rows
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

            // JS/CPU
            const cpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: false, gpu: false } },
            )) {
              cpuRecords.push(record as Record<string, string>);
            }

            // WASM
            const wasmRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStream(
              stringToStream(csvData),
              { engine: { wasm: true, gpu: false } },
            )) {
              wasmRecords.push(record as Record<string, string>);
            }

            // GPU
            const gpuRecords: Record<string, string>[] = [];
            for await (const record of parseBinaryStreamInGPU(
              stringToStream(csvData),
            )) {
              gpuRecords.push(record as Record<string, string>);
            }

            expect(wasmRecords.length).toBe(cpuRecords.length);
            expect(gpuRecords.length).toBe(cpuRecords.length);

            for (let i = 0; i < cpuRecords.length; i++) {
              expect(wasmRecords[i]).toEqual(cpuRecords[i]);
              expect(gpuRecords[i]).toEqual(cpuRecords[i]);
            }

            return true;
          },
        ),
        { numRuns: 30, endOnFailure: true },
      );
    },
  );
});
