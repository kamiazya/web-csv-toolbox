/**
 * Minimal reproduction test for empty row handling discrepancy
 * Found by PBT in headerless mode
 */

import { describe, expect, test } from "vitest";
import {
  test as gpuTest,
  skipIfNoWebGPU,
} from "@/__tests__/webgpu/webgpu-fixture.ts";
import { parseBinaryStream } from "@/parser/api/binary/parseBinaryStream.ts";
import { parseBinaryStreamInGPU } from "@/parser/execution/gpu/parseBinaryStreamInGPU.ts";

function stringToStream(str: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(str);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("Empty row handling discrepancy", () => {
  test("JS/CPU vs WASM: empty row in headerless mode", async () => {
    // CSV with an empty row (line 4)
    const csv = `a,b,c
d,e,f

g,h,i`;

    // JS/CPU
    const cpuRecords: string[][] = [];
    for await (const record of parseBinaryStream(stringToStream(csv), {
      engine: { wasm: false, gpu: false },
      header: [] as const,
      outputFormat: "array",
    })) {
      cpuRecords.push(record as unknown as string[]);
    }

    // WASM
    const wasmRecords: string[][] = [];
    for await (const record of parseBinaryStream(stringToStream(csv), {
      engine: { wasm: true, gpu: false },
      header: [] as const,
      outputFormat: "array",
    })) {
      wasmRecords.push(record as unknown as string[]);
    }

    console.log("JS/CPU records:", cpuRecords);
    console.log("WASM records:", wasmRecords);

    expect(wasmRecords).toEqual(cpuRecords);
  });

  gpuTest("GPU vs CPU: empty row in headerless mode", async ({ gpu, skip }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const csv = `a,b,c
d,e,f

g,h,i`;

    // JS/CPU
    const cpuRecords: string[][] = [];
    for await (const record of parseBinaryStream(stringToStream(csv), {
      engine: { wasm: false, gpu: false },
      header: [] as const,
      outputFormat: "array",
    })) {
      cpuRecords.push(record as unknown as string[]);
    }

    // GPU
    const gpuRecords: string[][] = [];
    for await (const record of parseBinaryStreamInGPU(stringToStream(csv), {
      header: [] as const,
      outputFormat: "array",
    })) {
      gpuRecords.push(record as unknown as string[]);
    }

    console.log("JS/CPU records:", cpuRecords);
    console.log("GPU records:", gpuRecords);

    expect(gpuRecords).toEqual(cpuRecords);
  });

  test("Simplified: single empty row", async () => {
    // Just an empty row
    const csv = `\n`;

    // JS/CPU
    const cpuRecords: string[][] = [];
    for await (const record of parseBinaryStream(stringToStream(csv), {
      engine: { wasm: false, gpu: false },
      header: [] as const,
      outputFormat: "array",
    })) {
      cpuRecords.push(record as unknown as string[]);
    }

    // WASM
    const wasmRecords: string[][] = [];
    for await (const record of parseBinaryStream(stringToStream(csv), {
      engine: { wasm: true, gpu: false },
      header: [] as const,
      outputFormat: "array",
    })) {
      wasmRecords.push(record as unknown as string[]);
    }

    console.log("Empty row - JS/CPU:", cpuRecords);
    console.log("Empty row - WASM:", wasmRecords);

    expect(wasmRecords).toEqual(cpuRecords);
  });
});
