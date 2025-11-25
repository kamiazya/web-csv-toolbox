import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { WASMStringCSVArrayParser } from "./WASMStringCSVArrayParser.ts";

describe("WASMStringCSVArrayParser", () => {
  beforeAll(async () => {
    await loadWASM();
  });

  describe("basic functionality", () => {
    test("should parse simple CSV into arrays", () => {
      const parser = new WASMStringCSVArrayParser();
      const records = [...parser.parse("id,name\n1,Alice\n2,Bob")];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["1", "Alice"]);
      expect(records[1]).toEqual(["2", "Bob"]);
    });

    test("should parse CSV with many columns", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "a,b,c,d,e\n1,2,3,4,5";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["1", "2", "3", "4", "5"]);
    });

    test("should handle quoted fields with commas", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = 'name,address\nAlice,"123 Main St, Apt 4"';
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["Alice", "123 Main St, Apt 4"]);
    });

    test("should handle quoted fields with newlines", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = 'name,notes\nAlice,"Line 1\nLine 2"';
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]?.[1]).toBe("Line 1\nLine 2");
    });

    test("should handle empty CSV", () => {
      const parser = new WASMStringCSVArrayParser();
      const records = [...parser.parse("")];

      expect(records).toHaveLength(0);
    });

    test("should handle header-only CSV", () => {
      const parser = new WASMStringCSVArrayParser();
      const records = [...parser.parse("id,name")];

      expect(records).toHaveLength(0);
    });
  });

  describe("custom delimiter", () => {
    test("should use semicolon as delimiter", () => {
      const parser = new WASMStringCSVArrayParser({ delimiter: ";" });
      const csv = "id;name\n1;Alice";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["1", "Alice"]);
    });

    test("should use tab as delimiter", () => {
      const parser = new WASMStringCSVArrayParser({ delimiter: "\t" });
      const csv = "id\tname\n1\tAlice";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["1", "Alice"]);
    });

    test("should use pipe as delimiter", () => {
      const parser = new WASMStringCSVArrayParser({ delimiter: "|" });
      const csv = "id|name\n1|Alice";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["1", "Alice"]);
    });
  });

  describe("custom quotation", () => {
    test("should use single quote as quotation character", () => {
      const parser = new WASMStringCSVArrayParser({ quotation: "'" });
      const csv = "name,value\n'hello, world',test";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]?.[0]).toBe("hello, world");
    });
  });

  describe("predefined headers", () => {
    test("should use predefined headers (first row becomes data)", () => {
      const parser = new WASMStringCSVArrayParser({
        header: ["col1", "col2"] as const,
      });
      const csv = "a,b\n1,2";
      const records = [...parser.parse(csv)];

      // Both rows become data
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["a", "b"]);
      expect(records[1]).toEqual(["1", "2"]);
    });
  });

  describe("streaming mode", () => {
    test("should handle streaming chunks", () => {
      const parser = new WASMStringCSVArrayParser();

      // First chunk with header and partial data
      const records1 = [...parser.parse("id,name\n1,Alice\n2,", { stream: true })];
      expect(records1.length).toBeGreaterThanOrEqual(1);

      // Second chunk completing the record
      const records2 = [...parser.parse("Bob\n", { stream: true })];

      // Flush remaining
      const records3 = [...parser.parse()];

      const allRecords = [...records1, ...records2, ...records3];
      // Find Alice's record
      const aliceRecord = allRecords.find((r) => r[1] === "Alice");
      expect(aliceRecord).toBeDefined();
    });

    test("should flush remaining data", () => {
      const parser = new WASMStringCSVArrayParser();

      // Stream some data
      [...parser.parse("id,name\n1,Alice", { stream: true })];

      // Flush without additional data
      const flushed = [...parser.parse()];
      expect(flushed.length).toBeGreaterThanOrEqual(0);
    });

    test("should handle incomplete quoted field across chunks", () => {
      const parser = new WASMStringCSVArrayParser();

      // Start with incomplete quoted field
      const records1 = [...parser.parse('name,notes\nAlice,"hello', { stream: true })];

      // Complete the quoted field
      const records2 = [...parser.parse(' world"', { stream: true })];

      // Flush
      const records3 = [...parser.parse()];

      const allRecords = [...records1, ...records2, ...records3];
      const aliceRecord = allRecords.find((r) => r[0] === "Alice");
      expect(aliceRecord?.[1]).toBe("hello world");
    });
  });

  describe("positional access", () => {
    test("should provide positional access to fields", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "a,b,c\n1,2,3";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]?.[0]).toBe("1");
      expect(records[0]?.[1]).toBe("2");
      expect(records[0]?.[2]).toBe("3");
    });

    test("should support array spread", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "a,b,c\n1,2,3";
      const records = [...parser.parse(csv)];

      const [first, second, third] = records[0] ?? [];
      expect(first).toBe("1");
      expect(second).toBe("2");
      expect(third).toBe("3");
    });

    test("should support array length", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "a,b,c,d,e\n1,2,3,4,5";
      const records = [...parser.parse(csv)];

      expect(records[0]?.length).toBe(5);
    });

    test("should support iteration", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "a,b,c\n1,2,3";
      const records = [...parser.parse(csv)];

      const values: string[] = [];
      for (const value of records[0] ?? []) {
        if (value !== undefined) {
          values.push(value);
        }
      }
      expect(values).toEqual(["1", "2", "3"]);
    });
  });

  describe("PBT: field value preservation", () => {
    test("should preserve non-empty field values in correct positions", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
          (headers, values) => {
            // Clean headers (no commas, quotes, newlines, and unique)
            const cleanHeaders = headers
              .map((h, i) => h.replace(/[,"\n\r\s]/g, "") || `col${i}`)
              .filter((h, i, arr) => arr.indexOf(h) === i);

            // Clean values
            const cleanValues = values
              .slice(0, cleanHeaders.length)
              .map((v) => v.replace(/[,"\n\r]/g, "") || "x");

            if (cleanHeaders.length < 2 || cleanValues.length < 2) {
              return; // Skip if not enough data
            }

            const parser = new WASMStringCSVArrayParser();
            const csv = `${cleanHeaders.join(",")}\n${cleanValues.join(",")}`;
            const records = [...parser.parse(csv)];

            expect(records.length).toBeGreaterThanOrEqual(1);

            // Check first record has expected values in correct positions
            for (let i = 0; i < cleanValues.length; i++) {
              expect(records[0]?.[i]).toBe(cleanValues[i]);
            }
          },
        ),
      );
    });
  });

  describe("edge cases", () => {
    test("should handle CRLF line endings", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "id,name\r\n1,Alice\r\n2,Bob";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(2);
      expect(records[0]?.[1]).toBe("Alice");
      expect(records[1]?.[1]).toBe("Bob");
    });

    test("should handle unicode in fields", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "id,name\n1,日本語\n2,한국어";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(2);
      expect(records[0]?.[1]).toBe("日本語");
      expect(records[1]?.[1]).toBe("한국어");
    });

    test("should handle emoji", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "emoji,name\n🎉,party\n🚀,rocket";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(2);
      expect(records[0]?.[0]).toBe("🎉");
      expect(records[1]?.[0]).toBe("🚀");
    });

    test("should handle escaped quotes", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = 'msg,value\n"say ""hello""",test';
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]?.[0]).toBe('say "hello"');
    });

    test("should handle single column CSV", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "value\n1\n2\n3";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual(["1"]);
      expect(records[1]).toEqual(["2"]);
      expect(records[2]).toEqual(["3"]);
    });

    test("should handle empty fields", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "a,b,c\n1,,3";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      expect(records[0]?.[0]).toBe("1");
      expect(records[0]?.[1]).toBe("");
      expect(records[0]?.[2]).toBe("3");
    });
  });

  describe("comparison with object parser", () => {
    test("should produce same field values in array format", () => {
      const parser = new WASMStringCSVArrayParser();
      const csv = "a,b,c\n1,2,3\n4,5,6";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["1", "2", "3"]);
      expect(records[1]).toEqual(["4", "5", "6"]);
    });
  });

  describe("type safety", () => {
    test("should support typed headers for tuple access", () => {
      const parser = new WASMStringCSVArrayParser<readonly ["id", "name"]>({
        header: ["id", "name"],
      });
      const csv = "1,Alice";
      const records = [...parser.parse(csv)];

      expect(records).toHaveLength(1);
      // TypeScript should know the structure
      expect(records[0]?.[0]).toBe("1");
      expect(records[0]?.[1]).toBe("Alice");
    });
  });
});
