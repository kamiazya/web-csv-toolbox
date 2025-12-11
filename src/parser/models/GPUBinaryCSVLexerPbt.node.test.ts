/**
 * Property-Based Tests for GPUBinaryCSVLexer
 *
 * Verifies that GPUBinaryCSVLexer produces identical token streams
 * to WasmBinaryCSVLexer (reference CPU implementation) for random CSV inputs.
 */

import fc from "fast-check";
import { beforeAll, describe } from "vitest";
import {
  convertGPUTokensToTokenFormat,
  normalizeToken,
} from "@/__tests__/webgpu/token-utils.ts";
import {
  expect,
  skipIfNoWebGPU,
  test,
} from "@/__tests__/webgpu/webgpu-fixture.ts";
import { WasmBinaryCSVLexer } from "@/parser/api/model/WasmBinaryCSVLexer.ts";
import { WasmIndexerBackend } from "@/parser/indexer/WasmIndexerBackend.ts";
import type { GPUToken } from "@/parser/webgpu/assembly/separatorsToTokens.ts";
import { CSVSeparatorIndexingBackend } from "@/parser/webgpu/indexing/CSVSeparatorIndexingBackend.ts";
import * as WasmModule from "@/wasm/WasmInstance.main.web.ts";
import { GPUBinaryCSVLexer } from "./GPUBinaryCSVLexer.ts";

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
 * Simple ASCII field generator (no special chars that need escaping)
 */
const simpleFieldArbitrary = fc
  .string({ minLength: 0, maxLength: 15 })
  .filter(
    (s) =>
      !s.includes(",") &&
      !s.includes("\n") &&
      !s.includes("\r") &&
      !s.includes('"'),
  );

/**
 * Field generator with special characters (requires escaping)
 */
const complexFieldArbitrary = fc.string({ minLength: 0, maxLength: 20 });

/**
 * CSV row generator
 */
const csvRowArbitrary = (numCols: number, fieldArb = simpleFieldArbitrary) =>
  fc.array(fieldArb, { minLength: numCols, maxLength: numCols });

// Try to initialize WASM synchronously for skipIf check
if (!WasmModule.isSyncInitialized()) {
  WasmModule.loadWasmSync();
}

describe.skipIf(!WasmModule.isInitialized() && !WasmModule.isSyncInitialized())(
  "GPUBinaryCSVLexer PBT: Token-level GPU vs CPU equivalence",
  () => {
    test(
      "PBT: should produce identical tokens to WasmBinaryCSVLexer for simple CSV",
      { timeout: 120000 },
      async ({ gpu, skip }) => {
        skipIfNoWebGPU(gpu, skip);

        Object.defineProperty(globalThis, "navigator", {
          value: { gpu },
          writable: true,
          configurable: true,
        });

        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 8 }), // number of columns
            fc.integer({ min: 1, max: 50 }), // number of rows
            fc.constantFrom("\n", "\r\n"), // line ending
            async (numCols, numRows, eol) => {
              // Generate CSV data
              const rows = fc.sample(csvRowArbitrary(numCols), numRows);
              const csvData = rows
                .map((r) => r.map(escapeField).join(","))
                .join(eol);
              const csvBytes = new TextEncoder().encode(csvData);

              // Create GPU backend
              const gpuBackend = new CSVSeparatorIndexingBackend();
              await gpuBackend.initialize();

              try {
                // Create GPU lexer
                const gpuLexer = new GPUBinaryCSVLexer({
                  backend: gpuBackend,
                  delimiter: ",",
                });

                // Create WASM backend
                const wasmBackend = new WasmIndexerBackend(",".charCodeAt(0));
                wasmBackend.initializeWithModule(WasmModule);

                // Create WASM lexer (reference CPU implementation)
                const wasmLexer = new WasmBinaryCSVLexer({
                  backend: wasmBackend,
                  delimiter: ",",
                });

                // Collect GPU tokens
                const rawGpuTokens: Array<{ type: number; value: string }> = [];
                for await (const token of gpuLexer.lex(csvBytes)) {
                  rawGpuTokens.push(
                    normalizeToken(token as unknown as GPUToken),
                  );
                }
                // Convert GPU tokens to Token format (merge Field + Delimiter)
                const gpuTokens = convertGPUTokensToTokenFormat(rawGpuTokens);

                // Collect WASM tokens
                const wasmTokens: Array<{ type: number; value: string }> = [];
                for (const token of wasmLexer.lex(csvBytes)) {
                  wasmTokens.push(normalizeToken(token));
                }

                // Compare token counts
                expect(gpuTokens.length).toBe(wasmTokens.length);

                // Compare each token
                for (let i = 0; i < gpuTokens.length; i++) {
                  expect(gpuTokens[i]).toEqual(wasmTokens[i]);
                }

                return true;
              } finally {
                await gpuBackend.destroy();
              }
            },
          ),
          { numRuns: 50, endOnFailure: true },
        );
      },
    );

    test(
      "PBT: should handle complex fields with quotes and special chars",
      { timeout: 120000 },
      async ({ gpu, skip }) => {
        skipIfNoWebGPU(gpu, skip);

        Object.defineProperty(globalThis, "navigator", {
          value: { gpu },
          writable: true,
          configurable: true,
        });

        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 5 }), // number of columns
            fc.integer({ min: 1, max: 20 }), // number of rows
            fc.constantFrom("\n", "\r\n"), // line ending
            async (numCols, numRows, eol) => {
              // Generate CSV data with complex fields
              const rows = fc.sample(
                csvRowArbitrary(numCols, complexFieldArbitrary),
                numRows,
              );
              const csvData = rows
                .map((r) => r.map(escapeField).join(","))
                .join(eol);
              const csvBytes = new TextEncoder().encode(csvData);

              // Create GPU backend
              const gpuBackend = new CSVSeparatorIndexingBackend();
              await gpuBackend.initialize();

              try {
                // Create GPU lexer
                const gpuLexer = new GPUBinaryCSVLexer({
                  backend: gpuBackend,
                  delimiter: ",",
                });

                // Create WASM backend
                const wasmBackend = new WasmIndexerBackend(",".charCodeAt(0));
                wasmBackend.initializeWithModule(WasmModule);

                // Create WASM lexer
                const wasmLexer = new WasmBinaryCSVLexer({
                  backend: wasmBackend,
                  delimiter: ",",
                });

                // Collect GPU tokens
                const rawGpuTokens2: Array<{ type: number; value: string }> =
                  [];
                for await (const token of gpuLexer.lex(csvBytes)) {
                  rawGpuTokens2.push(
                    normalizeToken(token as unknown as GPUToken),
                  );
                }
                // Convert GPU tokens to Token format (merge Field + Delimiter)
                const gpuTokens = convertGPUTokensToTokenFormat(rawGpuTokens2);

                // Collect WASM tokens
                const wasmTokens: Array<{ type: number; value: string }> = [];
                for (const token of wasmLexer.lex(csvBytes)) {
                  wasmTokens.push(normalizeToken(token));
                }

                // Compare
                expect(gpuTokens.length).toBe(wasmTokens.length);
                for (let i = 0; i < gpuTokens.length; i++) {
                  expect(gpuTokens[i]).toEqual(wasmTokens[i]);
                }

                return true;
              } finally {
                await gpuBackend.destroy();
              }
            },
          ),
          { numRuns: 30, endOnFailure: true },
        );
      },
    );

    test(
      "PBT: should handle streaming mode correctly",
      { timeout: 120000 },
      async ({ gpu, skip }) => {
        skipIfNoWebGPU(gpu, skip);

        Object.defineProperty(globalThis, "navigator", {
          value: { gpu },
          writable: true,
          configurable: true,
        });

        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 2, max: 6 }), // number of columns
            fc.array(
              fc.array(simpleFieldArbitrary, { minLength: 2, maxLength: 6 }),
              { minLength: 5, maxLength: 30 },
            ), // rows
            fc.constantFrom("\n", "\r\n"), // line ending
            fc.integer({ min: 1, max: 5 }), // number of chunks
            async (numCols, rows, eol, numChunks) => {
              // Normalize rows to have same column count
              const normalizedRows = rows.map((row) =>
                row
                  .slice(0, numCols)
                  .concat(Array(Math.max(0, numCols - row.length)).fill("")),
              );

              const csvData = normalizedRows
                .map((r) => r.map(escapeField).join(","))
                .join(eol);
              const csvBytes = new TextEncoder().encode(csvData);

              // Split into chunks
              const chunkSize = Math.ceil(csvBytes.length / numChunks);
              const chunks: Uint8Array[] = [];
              for (let i = 0; i < csvBytes.length; i += chunkSize) {
                chunks.push(csvBytes.slice(i, i + chunkSize));
              }

              // Create GPU backend
              const gpuBackend = new CSVSeparatorIndexingBackend();
              await gpuBackend.initialize();

              try {
                const gpuLexer = new GPUBinaryCSVLexer({
                  backend: gpuBackend,
                  delimiter: ",",
                });

                // Create WASM backend
                const wasmBackend = new WasmIndexerBackend(",".charCodeAt(0));
                wasmBackend.initializeWithModule(WasmModule);

                const wasmLexer = new WasmBinaryCSVLexer({
                  backend: wasmBackend,
                  delimiter: ",",
                });

                // Collect GPU tokens (streaming)
                const rawGpuTokens3: Array<{ type: number; value: string }> =
                  [];
                for (const chunk of chunks) {
                  for await (const token of gpuLexer.lex(chunk, {
                    stream: true,
                  })) {
                    rawGpuTokens3.push(
                      normalizeToken(token as unknown as GPUToken),
                    );
                  }
                }
                // Flush
                for await (const token of gpuLexer.lex()) {
                  rawGpuTokens3.push(
                    normalizeToken(token as unknown as GPUToken),
                  );
                }
                // Convert GPU tokens to Token format (merge Field + Delimiter)
                const gpuTokens = convertGPUTokensToTokenFormat(rawGpuTokens3);

                // Collect WASM tokens (streaming)
                const wasmTokens: Array<{ type: number; value: string }> = [];
                for (const chunk of chunks) {
                  for (const token of wasmLexer.lex(chunk, { stream: true })) {
                    wasmTokens.push(normalizeToken(token));
                  }
                }
                // Flush
                for (const token of wasmLexer.lex()) {
                  wasmTokens.push(normalizeToken(token));
                }

                // Compare
                if (gpuTokens.length !== wasmTokens.length) {
                  console.error(
                    `Token count mismatch: GPU=${gpuTokens.length}, WASM=${wasmTokens.length}`,
                  );
                  console.error(`CSV data: ${JSON.stringify(csvData)}`);
                  console.error(`GPU tokens:`, gpuTokens);
                  console.error(`WASM tokens:`, wasmTokens);
                }
                expect(gpuTokens.length).toBe(wasmTokens.length);
                for (let i = 0; i < gpuTokens.length; i++) {
                  if (
                    JSON.stringify(gpuTokens[i]) !==
                    JSON.stringify(wasmTokens[i])
                  ) {
                    console.error(`Token mismatch at index ${i}:`);
                    console.error(`  GPU:`, gpuTokens[i]);
                    console.error(`  WASM:`, wasmTokens[i]);
                    console.error(
                      `  Context (GPU ${Math.max(0, i - 2)} to ${Math.min(gpuTokens.length - 1, i + 2)}):`,
                      gpuTokens.slice(
                        Math.max(0, i - 2),
                        Math.min(gpuTokens.length, i + 3),
                      ),
                    );
                    console.error(
                      `  Context (WASM ${Math.max(0, i - 2)} to ${Math.min(wasmTokens.length - 1, i + 2)}):`,
                      wasmTokens.slice(
                        Math.max(0, i - 2),
                        Math.min(wasmTokens.length, i + 3),
                      ),
                    );
                  }
                  expect(gpuTokens[i]).toEqual(wasmTokens[i]);
                }

                return true;
              } finally {
                await gpuBackend.destroy();
              }
            },
          ),
          { numRuns: 40, endOnFailure: true },
        );
      },
    );

    test(
      "PBT: should handle edge cases (empty fields, single char, etc.)",
      { timeout: 120000 },
      async ({ gpu, skip }) => {
        skipIfNoWebGPU(gpu, skip);

        Object.defineProperty(globalThis, "navigator", {
          value: { gpu },
          writable: true,
          configurable: true,
        });

        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 10 }), // number of columns
            fc.integer({ min: 1, max: 15 }), // number of rows
            fc.constantFrom("\n", "\r\n"),
            async (numCols, numRows, eol) => {
              // Generate rows with mix of empty and single-char fields
              const edgeCaseFieldArbitrary = fc.constantFrom("", "a", "1", " ");
              const rows = fc.sample(
                fc.array(edgeCaseFieldArbitrary, {
                  minLength: numCols,
                  maxLength: numCols,
                }),
                numRows,
              );

              const csvData = rows
                .map((r) => r.map(escapeField).join(","))
                .join(eol);
              const csvBytes = new TextEncoder().encode(csvData);

              // Create GPU backend
              const gpuBackend = new CSVSeparatorIndexingBackend();
              await gpuBackend.initialize();

              try {
                const gpuLexer = new GPUBinaryCSVLexer({
                  backend: gpuBackend,
                  delimiter: ",",
                });

                // Create WASM backend
                const wasmBackend = new WasmIndexerBackend(",".charCodeAt(0));
                wasmBackend.initializeWithModule(WasmModule);

                const wasmLexer = new WasmBinaryCSVLexer({
                  backend: wasmBackend,
                  delimiter: ",",
                });

                // Collect tokens
                const rawGpuTokens4: Array<{ type: number; value: string }> =
                  [];
                for await (const token of gpuLexer.lex(csvBytes)) {
                  rawGpuTokens4.push(
                    normalizeToken(token as unknown as GPUToken),
                  );
                }
                // Convert GPU tokens to Token format (merge Field + Delimiter)
                const gpuTokens = convertGPUTokensToTokenFormat(rawGpuTokens4);

                const wasmTokens: Array<{ type: number; value: string }> = [];
                for (const token of wasmLexer.lex(csvBytes)) {
                  wasmTokens.push(normalizeToken(token));
                }

                // Compare
                if (gpuTokens.length !== wasmTokens.length) {
                  console.error(
                    `Token count mismatch: GPU=${gpuTokens.length}, WASM=${wasmTokens.length}`,
                  );
                  console.error(`CSV data: ${JSON.stringify(csvData)}`);
                  console.error(`GPU tokens:`, gpuTokens);
                  console.error(`WASM tokens:`, wasmTokens);
                }
                expect(gpuTokens.length).toBe(wasmTokens.length);
                for (let i = 0; i < gpuTokens.length; i++) {
                  if (
                    JSON.stringify(gpuTokens[i]) !==
                    JSON.stringify(wasmTokens[i])
                  ) {
                    console.error(`Token mismatch at index ${i}:`);
                    console.error(`  GPU:`, gpuTokens[i]);
                    console.error(`  WASM:`, wasmTokens[i]);
                    console.error(
                      `  Context (GPU ${Math.max(0, i - 2)} to ${Math.min(gpuTokens.length - 1, i + 2)}):`,
                      gpuTokens.slice(
                        Math.max(0, i - 2),
                        Math.min(gpuTokens.length, i + 3),
                      ),
                    );
                    console.error(
                      `  Context (WASM ${Math.max(0, i - 2)} to ${Math.min(wasmTokens.length - 1, i + 2)}):`,
                      wasmTokens.slice(
                        Math.max(0, i - 2),
                        Math.min(wasmTokens.length, i + 3),
                      ),
                    );
                  }
                  expect(gpuTokens[i]).toEqual(wasmTokens[i]);
                }

                return true;
              } finally {
                await gpuBackend.destroy();
              }
            },
          ),
          { numRuns: 25, endOnFailure: true },
        );
      },
    );
  },
);
