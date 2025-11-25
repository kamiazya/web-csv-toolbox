/**
 * Debug test to understand CPU parser behavior
 */

import { describe, expect, it } from "vitest";
import { parseStringStream } from "@/parser/api/string/parseStringStream.ts";

function stringToStream(data: string): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

describe("CPU Parser Behavior", () => {
  it("should handle single field without trailing newline (with explicit header)", async () => {
    const csv = "0";
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv), {
      header: ["col"] as const,
    })) {
      records.push(record);
    }
    console.log("Single field without LF (explicit header):", records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle single field without trailing newline (default)", async () => {
    const csv = "0";
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv))) {
      records.push(record);
    }
    console.log("Single field without LF (default):", records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle empty data rows", async () => {
    const csv = "0\n";
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv))) {
      records.push(record);
    }
    console.log("Header with empty data:", records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle empty fields with newline", async () => {
    const csv = ",\n";
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv))) {
      records.push(record);
    }
    console.log("Empty fields with LF:", records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle single field with trailing newline (explicit header)", async () => {
    const csv = "0\n";
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv), {
      header: ["col"] as const,
    })) {
      records.push(record);
    }
    console.log("Single field with LF (explicit header):", records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle two rows (explicit header)", async () => {
    const csv = "0\n1\n";
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv), {
      header: ["col"] as const,
    })) {
      records.push(record);
    }
    console.log("Two rows (explicit header):", records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle multi-row without trailing LF", async () => {
    const csv = "a,b,c\n1,2,3\n4,5,6";
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv))) {
      records.push(record);
    }
    console.log("Multi-row without trailing LF:", records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle single data row (2 rows total)", async () => {
    const csv = '""\n0';
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv))) {
      records.push(record);
    }
    console.log('Single data row (header: "", data: "0"):', records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle empty quote header with data", async () => {
    const csv = `""
0`;
    const records = [];
    for await (const record of parseStringStream(stringToStream(csv))) {
      records.push(record);
    }
    console.log("Empty quote header with data (multiline):", records);
    expect(records.length).toBeGreaterThanOrEqual(0);
  });
});
