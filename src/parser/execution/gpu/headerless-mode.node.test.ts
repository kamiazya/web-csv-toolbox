/**
 * Tests for GPU parser headerless mode bug fix
 *
 * Verifies that header: [] is correctly handled and doesn't consume the first data row.
 */

import { describe } from "vitest";
import {
  expect,
  skipIfNoWebGPU,
  test,
} from "@/__tests__/webgpu/webgpu-fixture.ts";
import { parseBinaryStreamInGPU } from "./parseBinaryStreamInGPU.ts";
import { parseStringInGPU } from "./parseStringInGPU.ts";
import { parseStringStreamInGPU } from "./parseStringStreamInGPU.ts";

describe("GPU headerless mode", () => {
  const testCSV = "1,2,3\n4,5,6\n7,8,9";
  const expectedRows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];

  test("parseStringInGPU should not lose first row with header: []", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    // Set up global navigator for GPU access
    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const result = [];
    for await (const row of parseStringInGPU(testCSV, {
      header: [] as const,
      outputFormat: "array",
    })) {
      result.push(row);
    }

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expectedRows[0]);
    expect(result[1]).toEqual(expectedRows[1]);
    expect(result[2]).toEqual(expectedRows[2]);
  });

  test("parseBinaryStreamInGPU should not lose first row with header: []", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const encoder = new TextEncoder();
    const csvBuffer = encoder.encode(testCSV);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(csvBuffer);
        controller.close();
      },
    });

    // Skip if ReadableStream doesn't support getReader (Node.js compatibility)
    if (typeof stream.getReader !== "function") {
      skip();
      return;
    }

    const result = [];
    for await (const row of parseBinaryStreamInGPU(stream, {
      header: [] as const,
      outputFormat: "array",
    })) {
      result.push(row);
    }

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expectedRows[0]);
    expect(result[1]).toEqual(expectedRows[1]);
    expect(result[2]).toEqual(expectedRows[2]);
  });

  test("parseStringStreamInGPU should not lose first row with header: []", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(testCSV);
        controller.close();
      },
    });

    // Skip if ReadableStream doesn't support pipeThrough (Node.js compatibility)
    if (typeof stream.pipeThrough !== "function") {
      skip();
      return;
    }

    const result = [];
    for await (const row of parseStringStreamInGPU(stream, {
      header: [] as const,
      outputFormat: "array",
    })) {
      result.push(row);
    }

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expectedRows[0]);
    expect(result[1]).toEqual(expectedRows[1]);
    expect(result[2]).toEqual(expectedRows[2]);
  });

  test("parseStringInGPU with object format and header: [] should use numeric keys", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const result = [];
    for await (const row of parseStringInGPU(testCSV, {
      header: [] as const,
      outputFormat: "object",
    })) {
      result.push(row);
    }

    expect(result).toHaveLength(3);
    // With empty header in object format, should create object with numeric keys
    expect(result[0]).toEqual({ "0": "1", "1": "2", "2": "3" });
    expect(result[1]).toEqual({ "0": "4", "1": "5", "2": "6" });
    expect(result[2]).toEqual({ "0": "7", "1": "8", "2": "9" });
  });

  test("GPU parser should still read header from first row when header is undefined", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const csvWithHeader = "a,b,c\n1,2,3\n4,5,6";
    const result = [];

    for await (const row of parseStringInGPU(csvWithHeader, {
      // header is undefined - should read from first row
    })) {
      result.push(row);
    }

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ a: "1", b: "2", c: "3" });
    expect(result[1]).toEqual({ a: "4", b: "5", c: "6" });
  });

  test("GPU parser comparison: header: [] vs undefined vs explicit header", async ({
    gpu,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    Object.defineProperty(globalThis, "navigator", {
      value: { gpu },
      writable: true,
      configurable: true,
    });

    const csv = "x,y,z\n1,2,3\n4,5,6";

    // Case 1: header: [] (headerless) - should get all 3 rows as data
    const headerless = [];
    for await (const row of parseStringInGPU(csv, {
      header: [] as const,
      outputFormat: "array",
    })) {
      headerless.push(row);
    }

    // Case 2: header: undefined (auto) - should read header from first row, get 2 data rows
    const autoHeader = [];
    for await (const row of parseStringInGPU(csv)) {
      autoHeader.push(row);
    }

    // Case 3: header: ["col1", "col2", "col3"] - should get all 3 rows as data with custom header
    const explicitHeader = [];
    for await (const row of parseStringInGPU(csv, {
      header: ["col1", "col2", "col3"] as const,
    })) {
      explicitHeader.push(row);
    }

    // Verify different behaviors
    expect(headerless).toHaveLength(3); // All rows are data
    expect(autoHeader).toHaveLength(2); // First row consumed as header
    expect(explicitHeader).toHaveLength(3); // All rows are data with custom header

    // Verify headerless mode preserved all rows
    expect(headerless[0]).toEqual(["x", "y", "z"]);
    expect(headerless[1]).toEqual(["1", "2", "3"]);
    expect(headerless[2]).toEqual(["4", "5", "6"]);

    // Verify auto header mode used first row as header
    expect(autoHeader[0]).toEqual({ x: "1", y: "2", z: "3" });
    expect(autoHeader[1]).toEqual({ x: "4", y: "5", z: "6" });

    // Verify explicit header mode used custom header
    expect(explicitHeader[0]).toEqual({ col1: "x", col2: "y", col3: "z" });
    expect(explicitHeader[1]).toEqual({ col1: "1", col2: "2", col3: "3" });
    expect(explicitHeader[2]).toEqual({ col1: "4", col2: "5", col3: "6" });
  });
});
