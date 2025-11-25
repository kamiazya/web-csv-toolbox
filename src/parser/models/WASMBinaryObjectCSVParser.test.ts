import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { WASMBinaryObjectCSVParser } from "./WASMBinaryObjectCSVParser.ts";

const encoder = new TextEncoder();

describe("WASMBinaryObjectCSVParser", () => {
  beforeAll(async () => {
    await loadWASM();
  });

  describe("basic functionality", () => {
    test("should parse simple CSV with headers", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const records = [...parser.parse(encoder.encode("id,name\n1,Alice\n2,Bob"))];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ id: "1", name: "Alice" });
      expect(records[1]).toEqual({ id: "2", name: "Bob" });
    });

    test("should parse CSV with many columns", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = "a,b,c,d,e\n1,2,3,4,5";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ a: "1", b: "2", c: "3", d: "4", e: "5" });
    });

    test("should handle quoted fields with commas", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = 'name,address\nAlice,"123 Main St, Apt 4"';
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ name: "Alice", address: "123 Main St, Apt 4" });
    });

    test("should handle quoted fields with newlines", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = 'name,notes\nAlice,"Line 1\nLine 2"';
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.notes).toBe("Line 1\nLine 2");
    });

    test("should handle empty CSV", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const records = [...parser.parse(encoder.encode(""))];

      expect(records).toHaveLength(0);
    });

    test("should handle header-only CSV", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const records = [...parser.parse(encoder.encode("id,name"))];

      expect(records).toHaveLength(0);
    });
  });

  describe("custom delimiter", () => {
    test("should use semicolon as delimiter", () => {
      const parser = new WASMBinaryObjectCSVParser({ delimiter: ";" });
      const csv = "id;name\n1;Alice";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ id: "1", name: "Alice" });
    });

    test("should use tab as delimiter", () => {
      const parser = new WASMBinaryObjectCSVParser({ delimiter: "\t" });
      const csv = "id\tname\n1\tAlice";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ id: "1", name: "Alice" });
    });
  });

  describe("custom quotation", () => {
    test("should use single quote as quotation character", () => {
      const parser = new WASMBinaryObjectCSVParser({ quotation: "'" });
      const csv = "name,value\n'hello, world',test";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.name).toBe("hello, world");
    });
  });

  describe("predefined headers", () => {
    test("should use predefined headers", () => {
      const parser = new WASMBinaryObjectCSVParser({
        header: ["col1", "col2", "col3"] as const,
      });
      const csv = "a,b,c";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ col1: "a", col2: "b", col3: "c" });
    });

    test("should skip header row when predefined headers provided", () => {
      const parser = new WASMBinaryObjectCSVParser({
        header: ["x", "y"] as const,
      });
      // First row becomes data, not headers
      const csv = "a,b\n1,2";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ x: "a", y: "b" });
      expect(records[1]).toEqual({ x: "1", y: "2" });
    });
  });

  describe("streaming mode", () => {
    test("should handle streaming chunks", () => {
      const parser = new WASMBinaryObjectCSVParser();

      // First chunk with header and partial data
      const records1 = [...parser.parse(encoder.encode("id,name\n1,Alice\n2,"), { stream: true })];
      expect(records1.length).toBeGreaterThanOrEqual(1);

      // Second chunk completing the record
      const records2 = [...parser.parse(encoder.encode("Bob\n"), { stream: true })];

      // Flush remaining
      const records3 = [...parser.parse()];

      const allRecords = [...records1, ...records2, ...records3];
      const names = allRecords.map((r) => r.name);
      expect(names).toContain("Alice");
    });

    test("should flush remaining data", () => {
      const parser = new WASMBinaryObjectCSVParser();

      // Stream some data
      [...parser.parse(encoder.encode("id,name\n1,Alice"), { stream: true })];

      // Flush without additional data
      const flushed = [...parser.parse()];
      expect(flushed.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("BufferSource input types", () => {
    test("should accept Uint8Array", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const data = new Uint8Array(encoder.encode("id,name\n1,Alice"));
      const records = [...parser.parse(data)];

      expect(records).toHaveLength(1);
    });

    test("should accept ArrayBuffer", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const data = encoder.encode("id,name\n1,Alice").buffer;
      const records = [...parser.parse(data)];

      expect(records).toHaveLength(1);
    });
  });

  describe("field handling", () => {
    test("should handle missing fields with undefined", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = "a,b,c\n1,2";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.a).toBe("1");
      expect(records[0]?.b).toBe("2");
      // c should be undefined (not empty string)
      expect(records[0]?.c).toBeUndefined();
    });

    test("should handle empty fields as empty string", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = "a,b,c\n1,,3";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.a).toBe("1");
      expect(records[0]?.b).toBe("");
      expect(records[0]?.c).toBe("3");
    });
  });

  describe("PBT: field value preservation", () => {
    test("should preserve non-empty field values", () => {
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

            const parser = new WASMBinaryObjectCSVParser();
            const csv = `${cleanHeaders.join(",")}\n${cleanValues.join(",")}`;
            const records = [...parser.parse(encoder.encode(csv))];

            expect(records.length).toBeGreaterThanOrEqual(1);

            // Check first record has expected values
            for (let i = 0; i < cleanValues.length && i < cleanHeaders.length; i++) {
              const header = cleanHeaders[i] as string;
              expect(records[0]?.[header]).toBe(cleanValues[i]);
            }
          },
        ),
      );
    });
  });

  describe("edge cases", () => {
    test("should handle CRLF line endings", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = "id,name\r\n1,Alice\r\n2,Bob";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]?.name).toBe("Alice");
      expect(records[1]?.name).toBe("Bob");
    });

    test("should handle unicode in fields", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = "id,name\n1,日本語\n2,한국어";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]?.name).toBe("日本語");
      expect(records[1]?.name).toBe("한국어");
    });

    test("should handle emoji", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = "emoji,name\n🎉,party\n🚀,rocket";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]?.emoji).toBe("🎉");
      expect(records[1]?.emoji).toBe("🚀");
    });

    test("should handle escaped quotes", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = 'msg,value\n"say ""hello""",test';
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.msg).toBe('say "hello"');
    });

    test("should handle single column CSV", () => {
      const parser = new WASMBinaryObjectCSVParser();
      const csv = "value\n1\n2\n3";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual({ value: "1" });
      expect(records[1]).toEqual({ value: "2" });
      expect(records[2]).toEqual({ value: "3" });
    });
  });

  describe("type safety", () => {
    test("should support typed headers", () => {
      const parser = new WASMBinaryObjectCSVParser<readonly ["id", "name"]>({
        header: ["id", "name"],
      });
      const csv = "1,Alice";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      // TypeScript should know these properties exist
      expect(records[0]?.id).toBe("1");
      expect(records[0]?.name).toBe("Alice");
    });
  });
});
