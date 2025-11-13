import { describe, expect, it } from "vitest";
import { parseFile } from "../file/parseFile.ts";

describe("parseFile function", () => {
  it("should parse CSV from File", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const file = new File([csv], "test.csv", { type: "text/csv" });
    const expected = [
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ];

    let i = 0;
    for await (const row of parseFile(file)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse CSV using toArray method", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const file = new File([csv], "test.csv", { type: "text/csv" });
    const expected = [
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ];

    const records = await parseFile.toArray(file);
    expect(records).toStrictEqual(expected);
  });

  describe("automatic source tracking", () => {
    it("should automatically set file.name as source in errors", async () => {
      // Create CSV with field count exceeding limit
      const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(
        ",",
      );
      const file = new File([headers], "data.csv", { type: "text/csv" });

      try {
        for await (const _ of parseFile(file, { maxFieldCount: 5 })) {
          // Should throw before reaching here
        }
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as RangeError).message).toContain('in "data.csv"');
      }
    });

    it("should include filename in ParseError messages", async () => {
      // Create invalid CSV: unclosed quoted field
      const csv = '"name","age"\n"Alice';
      const file = new File([csv], "users.csv", { type: "text/csv" });

      try {
        // Consume all records to trigger error
        const records = [];
        for await (const record of parseFile(file)) {
          records.push(record);
        }
        expect.fail("Should have thrown ParseError");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("ParseError");
        expect((error as any).source).toBe("users.csv");
      }
    });

    it("should respect user-provided source option over file.name", async () => {
      const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(
        ",",
      );
      const file = new File([headers], "data.csv", { type: "text/csv" });

      try {
        for await (const _ of parseFile(file, {
          maxFieldCount: 5,
          source: "custom-source.csv",
        })) {
          // Should throw before reaching here
        }
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as RangeError).message).toContain(
          'in "custom-source.csv"',
        );
        expect((error as RangeError).message).not.toContain('in "data.csv"');
      }
    });

    it("should handle files with special characters in name", async () => {
      const headers = Array.from({ length: 10 }, (_, i) => `field${i}`).join(
        ",",
      );
      const file = new File([headers], "データ (2024).csv", {
        type: "text/csv",
      });

      try {
        for await (const _ of parseFile(file, { maxFieldCount: 5 })) {
          // Should throw before reaching here
        }
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as RangeError).message).toContain("データ (2024).csv");
      }
    });
  });
});
