/**
 * Test specific failing cases from PBT to debug
 */

import { describe, expect, it } from "vitest";
import { parseStringStream } from "@/parser/api/string/parseStringStream.ts";
import type { CSVRecord } from "../indexing/types.ts";
import { StreamParser } from "./stream-parser.ts";

function stringToStream(data: string): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

function stringToBinaryStream(data: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

function normalizeRecord(record: CSVRecord): string[] {
  return record.fields.map((field) => field.value);
}

function normalizeStandardRecord(
  record: Record<string, string> | string[] | readonly string[],
): string[] {
  if (Array.isArray(record)) {
    return [...record];
  }
  return Object.values(record);
}

describe("Failing PBT Cases Debug", () => {
  it.skipIf(!navigator.gpu)("Case 1: Starts with newline", async () => {
    const csvData = '\n"",';

    console.log("=== Testing:", JSON.stringify(csvData));

    // Parse with WebGPU
    const gpuRecords: string[][] = [];
    const gpuParser = new StreamParser({
      onRecord: (record) => {
        const normalized = normalizeRecord(record);
        console.log("GPU record:", normalized);
        gpuRecords.push(normalized);
      },
    });

    await gpuParser.initialize();
    await gpuParser.parseStream(stringToBinaryStream(csvData));
    await gpuParser.destroy();

    console.log("GPU total records:", gpuRecords.length);

    // Parse with CPU
    const cpuRecords: string[][] = [];
    for await (const record of parseStringStream(stringToStream(csvData), {
      header: [],
      outputFormat: "array",
      skipEmptyLines: false,
    })) {
      const normalized = normalizeStandardRecord(record);
      console.log("CPU record:", normalized);
      cpuRecords.push(normalized);
    }

    console.log("CPU total records:", cpuRecords.length);

    // Compare
    expect(gpuRecords.length).toBe(cpuRecords.length);
    for (let i = 0; i < gpuRecords.length; i++) {
      expect(gpuRecords[i]).toEqual(cpuRecords[i]);
    }
  });

  it.skipIf(!navigator.gpu)(
    "Case 2: Multi-line with trailing newline",
    async () => {
      const csvData = "-1000000\n1000000000,,-1000000000\n";

      console.log("=== Testing:", JSON.stringify(csvData));

      // Parse with WebGPU
      const gpuRecords: string[][] = [];
      const gpuParser = new StreamParser({
        onRecord: (record) => {
          const normalized = normalizeRecord(record);
          console.log("GPU record:", normalized);
          gpuRecords.push(normalized);
        },
      });

      await gpuParser.initialize();
      await gpuParser.parseStream(stringToBinaryStream(csvData));
      await gpuParser.destroy();

      console.log("GPU total records:", gpuRecords.length);

      // Parse with CPU
      const cpuRecords: string[][] = [];
      for await (const record of parseStringStream(stringToStream(csvData), {
        header: [],
        outputFormat: "array",
        skipEmptyLines: false,
      })) {
        const normalized = normalizeStandardRecord(record);
        console.log("CPU record:", normalized);
        cpuRecords.push(normalized);
      }

      console.log("CPU total records:", cpuRecords.length);

      // Compare
      expect(gpuRecords.length).toBe(cpuRecords.length);
      for (let i = 0; i < gpuRecords.length; i++) {
        expect(gpuRecords[i]).toEqual(cpuRecords[i]);
      }
    },
  );

  it.skipIf(!navigator.gpu)(
    "Case 3: Empty quoted field header with data",
    async () => {
      const csvData = `""
""`;

      console.log("=== Testing:", JSON.stringify(csvData));

      // Parse with WebGPU
      const gpuRecords: string[][] = [];
      const gpuParser = new StreamParser({
        onRecord: (record) => {
          const normalized = normalizeRecord(record);
          console.log("GPU record:", normalized);
          gpuRecords.push(normalized);
        },
      });

      await gpuParser.initialize();
      await gpuParser.parseStream(stringToBinaryStream(csvData));
      await gpuParser.destroy();

      console.log("GPU total records:", gpuRecords.length);

      // Parse with CPU
      const cpuRecords: string[][] = [];
      for await (const record of parseStringStream(stringToStream(csvData), {
        header: [],
        outputFormat: "array",
        skipEmptyLines: false,
      })) {
        const normalized = normalizeStandardRecord(record);
        console.log("CPU record:", normalized);
        cpuRecords.push(normalized);
      }

      console.log("CPU total records:", cpuRecords.length);

      // Compare
      expect(gpuRecords.length).toBe(cpuRecords.length);
      for (let i = 0; i < gpuRecords.length; i++) {
        expect(gpuRecords[i]).toEqual(cpuRecords[i]);
      }
    },
  );

  it.skipIf(!navigator.gpu)(
    "Case 4: Quoted spaces and plain spaces",
    async () => {
      const csvData = '"      ",   ,-100000000,100000000\n';

      console.log("=== Testing:", JSON.stringify(csvData));

      // Parse with WebGPU
      const gpuRecords: string[][] = [];
      const gpuParser = new StreamParser({
        onRecord: (record) => {
          const normalized = normalizeRecord(record);
          console.log("GPU record:", normalized);
          gpuRecords.push(normalized);
        },
      });

      await gpuParser.initialize();
      await gpuParser.parseStream(stringToBinaryStream(csvData));
      await gpuParser.destroy();

      console.log("GPU total records:", gpuRecords.length);

      // Parse with CPU
      const cpuRecords: string[][] = [];
      for await (const record of parseStringStream(stringToStream(csvData), {
        header: [],
        outputFormat: "array",
        skipEmptyLines: false,
      })) {
        const normalized = normalizeStandardRecord(record);
        console.log("CPU record:", normalized);
        cpuRecords.push(normalized);
      }

      console.log("CPU total records:", cpuRecords.length);

      // Compare
      expect(gpuRecords.length).toBe(cpuRecords.length);
      for (let i = 0; i < gpuRecords.length; i++) {
        expect(gpuRecords[i]).toEqual(cpuRecords[i]);
      }
    },
  );
});
