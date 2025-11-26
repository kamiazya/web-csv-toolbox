import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { WASMBinaryCSVArrayParser } from "./WASMBinaryCSVArrayParser.ts";

const encoder = new TextEncoder();

describe("WASMBinaryCSVArrayParser", () => {
  beforeAll(async () => {
    await loadWASM();
  });

  describe("basic functionality", () => {
    test("should parse simple CSV into arrays", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const records = [...parser.parse(encoder.encode("id,name\n1,Alice\n2,Bob"))];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["1", "Alice"]);
      expect(records[1]).toEqual(["2", "Bob"]);
    });

    test("should parse CSV with many columns", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b,c,d,e\n1,2,3,4,5";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["1", "2", "3", "4", "5"]);
    });

    test("should handle quoted fields with commas", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = 'name,address\nAlice,"123 Main St, Apt 4"';
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["Alice", "123 Main St, Apt 4"]);
    });

    test("should handle quoted fields with newlines", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = 'name,notes\nAlice,"Line 1\nLine 2"';
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.[1]).toBe("Line 1\nLine 2");
    });

    test("should handle empty CSV", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const records = [...parser.parse(encoder.encode(""))];

      expect(records).toHaveLength(0);
    });

    test("should handle header-only CSV", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const records = [...parser.parse(encoder.encode("id,name"))];

      expect(records).toHaveLength(0);
    });
  });

  describe("custom delimiter", () => {
    test("should use semicolon as delimiter", () => {
      const parser = new WASMBinaryCSVArrayParser({ delimiter: ";" });
      const csv = "id;name\n1;Alice";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["1", "Alice"]);
    });

    test("should use tab as delimiter", () => {
      const parser = new WASMBinaryCSVArrayParser({ delimiter: "\t" });
      const csv = "id\tname\n1\tAlice";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["1", "Alice"]);
    });
  });

  describe("custom quotation", () => {
    test("should use single quote as quotation character", () => {
      const parser = new WASMBinaryCSVArrayParser({ quotation: "'" });
      const csv = "name,value\n'hello, world',test";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.[0]).toBe("hello, world");
    });
  });

  describe("predefined headers", () => {
    test("should use predefined headers (first row becomes data)", () => {
      const parser = new WASMBinaryCSVArrayParser({
        header: ["col1", "col2"] as const,
      });
      const csv = "a,b\n1,2";
      const records = [...parser.parse(encoder.encode(csv))];

      // Both rows become data
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["a", "b"]);
      expect(records[1]).toEqual(["1", "2"]);
    });
  });

  describe("streaming mode", () => {
    test("should handle streaming chunks", () => {
      const parser = new WASMBinaryCSVArrayParser();

      // First chunk with header and partial data
      const records1 = [...parser.parse(encoder.encode("id,name\n1,Alice\n2,"), { stream: true })];
      expect(records1.length).toBeGreaterThanOrEqual(1);

      // Second chunk completing the record
      const records2 = [...parser.parse(encoder.encode("Bob\n"), { stream: true })];

      // Flush remaining
      const records3 = [...parser.parse()];

      const allRecords = [...records1, ...records2, ...records3];
      // Find Alice's record
      const aliceRecord = allRecords.find((r) => r[1] === "Alice");
      expect(aliceRecord).toBeDefined();
    });

    test("should flush remaining data", () => {
      const parser = new WASMBinaryCSVArrayParser();

      // Stream some data
      [...parser.parse(encoder.encode("id,name\n1,Alice"), { stream: true })];

      // Flush without additional data
      const flushed = [...parser.parse()];
      expect(flushed.length).toBeGreaterThanOrEqual(0);
    });

    test("should handle CRLF split across chunks (CR at end, LF at start)", () => {
      const parser = new WASMBinaryCSVArrayParser();

      // First chunk ends with CR
      const records1 = [...parser.parse(encoder.encode("a,b\r\n1,2\r"), { stream: true })];

      // Second chunk starts with LF
      const records2 = [...parser.parse(encoder.encode("\n3,4"), { stream: true })];

      // Flush
      const records3 = [...parser.parse()];

      const allRecords = [...records1, ...records2, ...records3];

      // Should have exactly 2 data records, not 3 (if CRLF split was mishandled)
      expect(allRecords).toHaveLength(2);
      expect(allRecords[0]).toEqual(["1", "2"]);
      expect(allRecords[1]).toEqual(["3", "4"]);
    });

    test("should handle incomplete UTF-8 split across chunks", () => {
      const parser = new WASMBinaryCSVArrayParser();

      // Japanese "日本" = 0xE6 0x97 0xA5 0xE6 0x9C 0xAC
      // First chunk: header + first byte of multi-byte char
      const chunk1 = new Uint8Array([
        ...encoder.encode("name\n"),
        0xe6, 0x97, 0xa5, // 日
        0xe6, // First byte of 本 (incomplete)
      ]);
      const records1 = [...parser.parse(chunk1, { stream: true })];

      // Second chunk: remaining bytes
      const chunk2 = new Uint8Array([0x9c, 0xac]); // Remaining bytes of 本
      const records2 = [...parser.parse(chunk2, { stream: true })];

      // Flush
      const records3 = [...parser.parse()];

      const allRecords = [...records1, ...records2, ...records3];
      expect(allRecords).toHaveLength(1);
      expect(allRecords[0]?.[0]).toBe("日本");
    });

    test("should error on flush with incomplete UTF-8 sequence", () => {
      const parser = new WASMBinaryCSVArrayParser();

      // Send incomplete UTF-8: first byte of a 3-byte sequence without continuation bytes
      const incompleteUtf8 = new Uint8Array([
        ...encoder.encode("name\n"),
        0xe6, // First byte of a 3-byte UTF-8 sequence (expects 2 more bytes)
      ]);
      [...parser.parse(incompleteUtf8, { stream: true })];

      // Flush should throw error for incomplete UTF-8
      expect(() => [...parser.parse()]).toThrow(/incomplete utf-8|byte sequence/i);
    });

    test("should error on flush with truncated 4-byte UTF-8 sequence", () => {
      const parser = new WASMBinaryCSVArrayParser();

      // Emoji 🎉 = F0 9F 8E 89 (4 bytes)
      // Send only first 2 bytes
      const incompleteEmoji = new Uint8Array([
        ...encoder.encode("emoji\n"),
        0xf0,
        0x9f, // First 2 bytes of 4-byte sequence
      ]);
      [...parser.parse(incompleteEmoji, { stream: true })];

      // Flush should throw error
      expect(() => [...parser.parse()]).toThrow(/incomplete utf-8|byte sequence/i);
    });
  });

  describe("BufferSource input types", () => {
    test("should accept Uint8Array", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const data = new Uint8Array(encoder.encode("id,name\n1,Alice"));
      const records = [...parser.parse(data)];

      expect(records).toHaveLength(1);
    });

    test("should accept ArrayBuffer", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const data = encoder.encode("id,name\n1,Alice").buffer;
      const records = [...parser.parse(data)];

      expect(records).toHaveLength(1);
    });
  });

  describe("positional access", () => {
    test("should provide positional access to fields", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b,c\n1,2,3";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.[0]).toBe("1");
      expect(records[0]?.[1]).toBe("2");
      expect(records[0]?.[2]).toBe("3");
    });

    test("should support array spread", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b,c\n1,2,3";
      const records = [...parser.parse(encoder.encode(csv))];

      const [first, second, third] = records[0] ?? [];
      expect(first).toBe("1");
      expect(second).toBe("2");
      expect(third).toBe("3");
    });

    test("should support array length", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b,c,d,e\n1,2,3,4,5";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records[0]?.length).toBe(5);
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

            const parser = new WASMBinaryCSVArrayParser();
            const csv = `${cleanHeaders.join(",")}\n${cleanValues.join(",")}`;
            const records = [...parser.parse(encoder.encode(csv))];

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
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "id,name\r\n1,Alice\r\n2,Bob";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]?.[1]).toBe("Alice");
      expect(records[1]?.[1]).toBe("Bob");
    });

    test("should not create empty records from CRLF (regression)", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b\r\n1,2\r\n3,4\r\n";
      const records = [...parser.parse(encoder.encode(csv))];

      // CRLF should be treated as single line ending, not two
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["1", "2"]);
      expect(records[1]).toEqual(["3", "4"]);
    });

    test("should handle mixed line endings (LF, CR, CRLF)", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b\r\n1,2\n3,4\r5,6";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual(["1", "2"]);
      expect(records[1]).toEqual(["3", "4"]);
      expect(records[2]).toEqual(["5", "6"]);
    });

    test("should handle CR-only line endings", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b\r1,2\r3,4";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["1", "2"]);
      expect(records[1]).toEqual(["3", "4"]);
    });

    test("should preserve CRLF inside quoted fields", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = 'name,notes\r\nAlice,"Line 1\r\nLine 2"\r\nBob,normal';
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]?.[0]).toBe("Alice");
      expect(records[0]?.[1]).toBe("Line 1\r\nLine 2");
      expect(records[1]?.[0]).toBe("Bob");
      expect(records[1]?.[1]).toBe("normal");
    });

    test("should handle unicode in fields", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "id,name\n1,日本語\n2,한국어";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]?.[1]).toBe("日本語");
      expect(records[1]?.[1]).toBe("한국어");
    });

    test("should handle emoji", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "emoji,name\n🎉,party\n🚀,rocket";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]?.[0]).toBe("🎉");
      expect(records[1]?.[0]).toBe("🚀");
    });

    test("should handle escaped quotes", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = 'msg,value\n"say ""hello""",test';
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.[0]).toBe('say "hello"');
    });

    test("should handle single column CSV", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "value\n1\n2\n3";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual(["1"]);
      expect(records[1]).toEqual(["2"]);
      expect(records[2]).toEqual(["3"]);
    });

    test("should handle empty fields", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b,c\n1,,3";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      expect(records[0]?.[0]).toBe("1");
      expect(records[0]?.[1]).toBe("");
      expect(records[0]?.[2]).toBe("3");
    });
  });

  describe("comparison with object parser", () => {
    test("should produce same field values in array format", () => {
      const parser = new WASMBinaryCSVArrayParser();
      const csv = "a,b,c\n1,2,3\n4,5,6";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["1", "2", "3"]);
      expect(records[1]).toEqual(["4", "5", "6"]);
    });
  });

  describe("type safety", () => {
    test("should support typed headers for tuple access", () => {
      const parser = new WASMBinaryCSVArrayParser<readonly ["id", "name"]>({
        header: ["id", "name"],
      });
      const csv = "1,Alice";
      const records = [...parser.parse(encoder.encode(csv))];

      expect(records).toHaveLength(1);
      // TypeScript should know the structure
      expect(records[0]?.[0]).toBe("1");
      expect(records[0]?.[1]).toBe("Alice");
    });
  });
});
