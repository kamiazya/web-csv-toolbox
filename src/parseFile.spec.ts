import { describe, expect, it } from "vitest";
import { parseFile } from "./parseFile.ts";

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
});
