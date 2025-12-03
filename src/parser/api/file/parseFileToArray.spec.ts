import { describe, expect, it } from "vitest";
import { parseFileToArray } from "@/parser/api/file/parseFileToArray.ts";

describe("parseFileToArray", () => {
  it("should parse CSV from File and return array", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const file = new File([csv], "test.csv", { type: "text/csv" });

    const records = await parseFileToArray(file);

    expect(records).toEqual([
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ]);
  });

  it("should handle empty CSV file", async () => {
    const file = new File([""], "empty.csv", { type: "text/csv" });

    const records = await parseFileToArray(file);

    expect(records).toEqual([]);
  });

  it("should handle CSV with only headers", async () => {
    const csv = "name,age";
    const file = new File([csv], "headers-only.csv", { type: "text/csv" });

    const records = await parseFileToArray(file);

    expect(records).toEqual([]);
  });

  it("should respect parsing options", async () => {
    const csv = "name\tage\nAlice\t42\nBob\t69";
    const file = new File([csv], "test.tsv", {
      type: "text/tab-separated-values",
    });

    const records = await parseFileToArray(file, { delimiter: "\t" } as any);

    expect(records).toEqual([
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ]);
  });

  it("should include filename in errors", async () => {
    // Create CSV with field count exceeding limit
    const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(",");
    const file = new File([headers], "data.csv", { type: "text/csv" });

    try {
      await parseFileToArray(file, { maxFieldCount: 5 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as RangeError).message).toContain('in "data.csv"');
    }
  });

  it("should respect user-provided source option", async () => {
    const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(",");
    const file = new File([headers], "data.csv", { type: "text/csv" });

    try {
      await parseFileToArray(file, {
        maxFieldCount: 5,
        source: "custom-source.csv",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as RangeError).message).toContain('in "custom-source.csv"');
      expect((error as RangeError).message).not.toContain('in "data.csv"');
    }
  });

  it("should handle large CSV files", async () => {
    // Create a CSV with 1000 rows
    const rows = ["name,age"];
    for (let i = 0; i < 1000; i++) {
      rows.push(`User${i},${20 + (i % 50)}`);
    }
    const csv = rows.join("\n");
    const file = new File([csv], "large.csv", { type: "text/csv" });

    const records = await parseFileToArray(file);

    expect(records).toHaveLength(1000);
    expect(records[0]).toEqual({ name: "User0", age: "20" });
    expect(records[999]).toEqual({ name: "User999", age: "69" }); // 20 + (999 % 50) = 20 + 49 = 69
  });

  it("should handle CSV with quoted fields", async () => {
    const csv = 'name,message\n"Alice","Hello, World"\n"Bob","Line1\\nLine2"';
    const file = new File([csv], "quoted.csv", { type: "text/csv" });

    const records = await parseFileToArray(file);

    expect(records).toEqual([
      { name: "Alice", message: "Hello, World" },
      { name: "Bob", message: "Line1\\nLine2" },
    ]);
  });
});
