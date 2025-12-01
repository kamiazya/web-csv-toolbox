import { assert, beforeEach, describe, expect, test } from "vitest";
import { FlexibleBinaryArrayCSVParser } from "./FlexibleBinaryArrayCSVParser.ts";
import { FlexibleBinaryObjectCSVParser } from "./FlexibleBinaryObjectCSVParser.ts";

describe("FlexibleBinaryCSVParser (Object and Array)", () => {
  const encoder = new TextEncoder();

  describe("Object format (default)", () => {
    let parser: FlexibleBinaryObjectCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
    });

    test("should parse binary CSV data into object records", () => {
      const csv = encoder.encode("Alice,30\nBob,25");
      const records = Array.from(parser.parse(csv));

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should parse empty binary data", () => {
      const csv = encoder.encode("");
      const records = Array.from(parser.parse(csv));
      expect(records).toEqual([]);
    });

    test("should parse single record", () => {
      const csv = encoder.encode("Alice,30");
      const records = Array.from(parser.parse(csv));
      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should parse with trailing newline", () => {
      const csv = encoder.encode("Alice,30\nBob,25\n");
      const records = Array.from(parser.parse(csv));
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should handle quoted fields", () => {
      const csv = encoder.encode('"Alice Smith",30\n"Bob Jones",25');
      const records = Array.from(parser.parse(csv));
      expect(records).toEqual([
        { name: "Alice Smith", age: "30" },
        { name: "Bob Jones", age: "25" },
      ]);
    });

    test("should handle fields with newlines in quotes", () => {
      const csv = encoder.encode('"Alice\nSmith",30\n"Bob",25');
      const records = Array.from(parser.parse(csv));
      expect(records).toEqual([
        { name: "Alice\nSmith", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should handle UTF-8 encoded data", () => {
      const csv = encoder.encode("日本語,30\n한글,25");
      const records = Array.from(parser.parse(csv));
      expect(records).toEqual([
        { name: "日本語", age: "30" },
        { name: "한글", age: "25" },
      ]);
    });
  });

  describe("BufferSource support", () => {
    let parser: FlexibleBinaryObjectCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
    });

    test("should accept ArrayBuffer as input", () => {
      const uint8 = encoder.encode("Alice,30\nBob,25");
      const arrayBuffer = uint8.buffer.slice(
        uint8.byteOffset,
        uint8.byteOffset + uint8.byteLength,
      );

      const records = Array.from(parser.parse(arrayBuffer));

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should accept Int8Array as input", () => {
      const uint8 = encoder.encode("Alice,30\nBob,25");
      const int8 = new Int8Array(
        uint8.buffer,
        uint8.byteOffset,
        uint8.byteLength,
      );

      const records = Array.from(parser.parse(int8));

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should accept DataView as input", () => {
      const uint8 = encoder.encode("Alice,30\nBob,25");
      const dataView = new DataView(
        uint8.buffer,
        uint8.byteOffset,
        uint8.byteLength,
      );

      const records = Array.from(parser.parse(dataView));

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should handle ArrayBuffer in streaming mode", () => {
      const uint8_1 = encoder.encode("Alice,30\nBob,");
      const arrayBuffer1 = uint8_1.buffer.slice(
        uint8_1.byteOffset,
        uint8_1.byteOffset + uint8_1.byteLength,
      );

      const records1 = Array.from(parser.parse(arrayBuffer1, { stream: true }));
      expect(records1).toEqual([{ name: "Alice", age: "30" }]);

      const uint8_2 = encoder.encode("25\nCharlie,35");
      const arrayBuffer2 = uint8_2.buffer.slice(
        uint8_2.byteOffset,
        uint8_2.byteOffset + uint8_2.byteLength,
      );

      const records2 = Array.from(parser.parse(arrayBuffer2));
      expect(records2).toEqual([
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "35" },
      ]);
    });

    test("should handle different TypedArray views in streaming mode", () => {
      const uint8_1 = encoder.encode("Alice,30\nBob,");
      const int8_1 = new Int8Array(
        uint8_1.buffer,
        uint8_1.byteOffset,
        uint8_1.byteLength,
      );

      const records1 = Array.from(parser.parse(int8_1, { stream: true }));
      expect(records1).toEqual([{ name: "Alice", age: "30" }]);

      const uint8_2 = encoder.encode("25");
      const dataView = new DataView(
        uint8_2.buffer,
        uint8_2.byteOffset,
        uint8_2.byteLength,
      );

      const records2 = Array.from(parser.parse(dataView));
      expect(records2).toEqual([{ name: "Bob", age: "25" }]);
    });
  });

  describe("Array format", () => {
    let parser: FlexibleBinaryArrayCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleBinaryArrayCSVParser({
        header: ["name", "age"] as const,

        charset: "utf-8",
      });
    });

    test("should parse binary CSV data into array records", () => {
      const csv = encoder.encode("Alice,30\nBob,25");
      const records = Array.from(parser.parse(csv));

      expect(records).toEqual([
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    test("should parse with includeHeader option", () => {
      const parserWithHeader = new FlexibleBinaryArrayCSVParser({
        header: ["name", "age"] as const,

        includeHeader: true,
        charset: "utf-8",
      });

      const csv = encoder.encode("Alice,30\nBob,25");
      const records = Array.from(parserWithHeader.parse(csv));

      expect(records).toEqual([
        ["name", "age"],
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    test("should preserve undefined for missing fields in array format (with sparse strategy)", () => {
      const parserWithSparse = new FlexibleBinaryArrayCSVParser({
        header: ["name", "age", "city"] as const,

        columnCountStrategy: "sparse",
        charset: "utf-8",
      });

      const records = Array.from(
        parserWithSparse.parse(encoder.encode("Alice,30\nBob")),
      );

      expect(records).toEqual([
        ["Alice", "30", undefined],
        ["Bob", undefined, undefined],
      ]);
    });
  });

  describe("Streaming mode", () => {
    let parser: FlexibleBinaryObjectCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
    });

    test("should handle incomplete records with stream: true", () => {
      // First chunk with incomplete record
      const records1 = Array.from(
        parser.parse(encoder.encode("Alice,30\nBob,"), {
          stream: true,
        }),
      );
      expect(records1).toEqual([{ name: "Alice", age: "30" }]);

      // Second chunk completes the record
      const records2 = Array.from(
        parser.parse(encoder.encode("25\nCharlie,35")),
      );
      expect(records2).toEqual([
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "35" },
      ]);
    });

    test("should flush incomplete data without stream option", () => {
      const records = Array.from(parser.parse(encoder.encode("Alice,30\nBob")));
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "" }, // Missing field filled with "" (fill strategy default)
      ]);
    });

    test("should handle multi-byte characters across chunk boundaries", () => {
      // Split UTF-8 multi-byte character across chunks
      const utf8Bytes = encoder.encode("あ"); // 3-byte UTF-8 character
      const chunk1 = utf8Bytes.slice(0, 2); // Incomplete character
      const chunk2 = utf8Bytes.slice(2); // Remaining byte

      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name"] as const,
        charset: "utf-8",
      });

      // First chunk should not produce complete record
      const records1 = Array.from(parser.parse(chunk1, { stream: true }));
      expect(records1).toEqual([]);

      // Second chunk completes the character
      const records2 = Array.from(parser.parse(chunk2));
      expect(records2).toEqual([{ name: "あ" }]);
    });
  });

  describe("Charset options", () => {
    test("should accept custom charset", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        charset: "shift_jis",
      });

      // This test just verifies the parser is created successfully with custom charset
      expect(parser).toBeDefined();
    });

    test("should throw error for invalid charset", () => {
      expect(() => {
        new FlexibleBinaryObjectCSVParser({
          header: ["name", "age"] as const,
          charset: "invalid-charset" as any,
        });
      }).toThrow(/Invalid or unsupported charset/);
    });

    test("should accept ignoreBOM option", () => {
      const parserWithBOM = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
        ignoreBOM: true,
      });

      // UTF-8 BOM: EF BB BF
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const data = encoder.encode("Alice,30");
      const withBOM = new Uint8Array(bom.length + data.length);
      withBOM.set(bom);
      withBOM.set(data, bom.length);

      const records = Array.from(parserWithBOM.parse(withBOM));
      // BOM should be stripped when ignoreBOM is true
      // However, the actual behavior depends on TextDecoder implementation
      expect(records).toHaveLength(1);
      expect(records[0]?.age).toBe("30");
    });

    test("should accept fatal option", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
        fatal: true,
      });

      expect(parser).toBeDefined();
    });
  });

  describe("Options validation", () => {
    test("should accept custom delimiter", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        delimiter: "\t" as any,
        charset: "utf-8",
      });

      const records = Array.from(
        parser.parse(encoder.encode("Alice\t30\nBob\t25")),
      );
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should accept custom quotation", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        quotation: "'" as any,
        charset: "utf-8",
      });

      const records = Array.from(
        parser.parse(encoder.encode("'Alice Smith',30\n'Bob',25")),
      );
      expect(records).toEqual([
        { name: "Alice Smith", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should handle skipEmptyLines option", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        skipEmptyLines: true,
        charset: "utf-8",
      });

      const records = Array.from(
        parser.parse(encoder.encode("Alice,30\n\nBob,25\n\n")),
      );
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Column count strategy", () => {
    test("should fill short rows with empty string in object format", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age", "city"] as const,
        columnCountStrategy: "fill",
        charset: "utf-8",
      });

      const records = Array.from(
        parser.parse(encoder.encode("Alice,30\nBob,25,NYC")),
      );
      expect(records).toEqual([
        { name: "Alice", age: "30", city: "" },
        { name: "Bob", age: "25", city: "NYC" },
      ]);
    });

    test("should throw error with 'strict' strategy on mismatch", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        columnCountStrategy: "strict",
        charset: "utf-8",
      });

      expect(() =>
        Array.from(parser.parse(encoder.encode("Alice,30,extra"))),
      ).toThrow();
    });

    test("should reject 'truncate' strategy for object output", () => {
      expect(() => {
        new FlexibleBinaryObjectCSVParser({
          header: ["name", "age"] as const,
          columnCountStrategy: "truncate",
          charset: "utf-8",
        });
      }).toThrow(
        /columnCountStrategy 'truncate' is not allowed for object format/,
      );
    });
  });

  describe("AbortSignal support", () => {
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
    });

    test("should throw AbortError when signal is aborted", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        signal: controller.signal,
        charset: "utf-8",
      });

      controller.abort();

      try {
        Array.from(parser.parse(encoder.encode("Alice,30\nBob,25")));
        expect.unreachable();
      } catch (error) {
        assert(error instanceof DOMException);
        expect(error.name).toBe("AbortError");
      }
    });

    test("should throw custom error when aborted with reason", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }

      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        signal: controller.signal,
        charset: "utf-8",
      });

      controller.abort(new CustomError("Custom abort"));

      expect(() =>
        Array.from(parser.parse(encoder.encode("Alice,30"))),
      ).toThrowErrorMatchingInlineSnapshot(`[CustomError: Custom abort]`);
    });
  });

  describe("Error handling", () => {
    test("should handle malformed quoted fields", () => {
      const parser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });

      expect(() =>
        Array.from(parser.parse(encoder.encode('"Alice,30'))),
      ).toThrow();
    });
  });

  describe("Integration with FlexibleStringObjectCSVParser", () => {
    test("should produce same results as string parser for ASCII data", async () => {
      const { FlexibleStringObjectCSVParser } = await import(
        "./FlexibleStringObjectCSVParser.ts"
      );

      const stringParser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });

      const binaryParser = new FlexibleBinaryObjectCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });

      const csvString = "Alice,30\nBob,25";
      const stringRecords = stringParser.parse(csvString);
      const binaryRecords = binaryParser.parse(encoder.encode(csvString));

      expect(binaryRecords).toEqual(stringRecords);
    });
  });
});
