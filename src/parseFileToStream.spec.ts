import { describe, expect, it } from "vitest";
import { parseFileToStream } from "./parseFileToStream.ts";

describe("parseFileToStream", () => {
  it("should parse CSV from File and return ReadableStream", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const file = new File([csv], "test.csv", { type: "text/csv" });

    const stream = parseFileToStream(file);
    const reader = stream.getReader();

    const records = [];
    let result = await reader.read();
    while (!result.done) {
      records.push(result.value);
      result = await reader.read();
    }

    expect(records).toStrictEqual([
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ]);
  });

  it("should handle empty CSV file", async () => {
    const file = new File([""], "empty.csv", { type: "text/csv" });

    const stream = parseFileToStream(file);
    const reader = stream.getReader();

    const result = await reader.read();
    expect(result.done).toBe(true);
  });

  it("should handle CSV with only headers", async () => {
    const csv = "name,age";
    const file = new File([csv], "headers-only.csv", { type: "text/csv" });

    const stream = parseFileToStream(file);
    const reader = stream.getReader();

    const result = await reader.read();
    expect(result.done).toBe(true);
  });

  it("should respect parsing options", async () => {
    const csv = "name\tage\nAlice\t42";
    const file = new File([csv], "test.tsv", {
      type: "text/tab-separated-values",
    });

    const stream = parseFileToStream(file, { delimiter: "\t" });
    const reader = stream.getReader();

    const result = await reader.read();
    expect(result.value).toStrictEqual({ name: "Alice", age: "42" });
  });

  it("should support streaming large files", async () => {
    // Create a CSV with 100 rows
    const rows = ["name,age"];
    for (let i = 0; i < 100; i++) {
      rows.push(`User${i},${20 + (i % 50)}`);
    }
    const csv = rows.join("\n");
    const file = new File([csv], "large.csv", { type: "text/csv" });

    const stream = parseFileToStream(file);
    const reader = stream.getReader();

    let count = 0;
    let result = await reader.read();
    while (!result.done) {
      count++;
      result = await reader.read();
    }

    expect(count).toBe(100);
  });

  it("should include filename in errors", async () => {
    // Create CSV with field count exceeding limit
    const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(",");
    const file = new File([headers], "data.csv", { type: "text/csv" });

    const stream = parseFileToStream(file, { maxFieldCount: 5 });
    const reader = stream.getReader();

    try {
      await reader.read();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as RangeError).message).toContain('in "data.csv"');
    }
  });

  it("should respect user-provided source option", async () => {
    const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(",");
    const file = new File([headers], "data.csv", { type: "text/csv" });

    const stream = parseFileToStream(file, {
      maxFieldCount: 5,
      source: "custom-source.csv",
    });
    const reader = stream.getReader();

    try {
      await reader.read();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as RangeError).message).toContain('in "custom-source.csv"');
      expect((error as RangeError).message).not.toContain('in "data.csv"');
    }
  });

  it("should be cancellable", async () => {
    const rows = ["name,age"];
    for (let i = 0; i < 1000; i++) {
      rows.push(`User${i},${20 + (i % 50)}`);
    }
    const csv = rows.join("\n");
    const file = new File([csv], "large.csv", { type: "text/csv" });

    const stream = parseFileToStream(file);
    const reader = stream.getReader();

    // Read a few records
    await reader.read();
    await reader.read();

    // Cancel the stream
    await reader.cancel();

    // Should complete without error
    const result = await reader.read();
    expect(result.done).toBe(true);
  });

  it("should handle quoted fields in streaming mode", async () => {
    const csv = 'name,message\n"Alice","Hello, World"\n"Bob","Hi there"';
    const file = new File([csv], "quoted.csv", { type: "text/csv" });

    const stream = parseFileToStream(file);
    const reader = stream.getReader();

    const record1 = await reader.read();
    expect(record1.value).toStrictEqual({
      name: "Alice",
      message: "Hello, World",
    });

    const record2 = await reader.read();
    expect(record2.value).toStrictEqual({ name: "Bob", message: "Hi there" });
  });
});
