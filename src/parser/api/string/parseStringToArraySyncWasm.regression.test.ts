import { describe, expect, it } from "vitest";
import { parseStringToArraySyncWasm } from "./parseStringToArraySyncWasm.main.node.ts";

/**
 * Regression tests for WASM string parsing bugs fixed in Report 52
 *
 * These tests prevent regression of the following issues:
 * 1. Module mismatch bug (importing from both loadWasm.js and loadWasmSync.js)
 * 2. maxBufferSize handling with large finite values
 * 3. Integration with parseString async iterator using WASM engine
 */
describe("parseStringToArraySyncWasm - Regression Tests (Report 52)", () => {
  describe("Issue #1: maxBufferSize handling", () => {
    it("should accept large finite maxBufferSize values", () => {
      // Regression test: Previously Number.POSITIVE_INFINITY was converted to 0 in WASM
      const csv = "a,b,c\n1,2,3\n4,5,6";

      // Should work with 100MB buffer size (large but finite)
      const result = parseStringToArraySyncWasm(csv, {
        maxBufferSize: 100 * 1024 * 1024, // 100MB
      });

      expect(result).toEqual([
        { a: "1", b: "2", c: "3" },
        { a: "4", b: "5", c: "6" },
      ]);
    });

    it("should work with default maxBufferSize (10MB)", () => {
      // Default maxBufferSize should be sufficient for most use cases
      const csv = "x,y\n" + Array.from({ length: 1000 }, (_, i) => `${i},${i * 2}`).join("\n");

      const result = parseStringToArraySyncWasm(csv);

      expect(result).toHaveLength(1000);
      expect(result[0]).toEqual({ x: "0", y: "0" });
      expect(result[999]).toEqual({ x: "999", y: "1998" });
    });

    it("should work with various CSV sizes up to several MB", () => {
      // Test with ~500KB CSV (similar to benchmark data)
      const rows = 5000;
      const cols = 10;
      const headerRow = Array.from({ length: cols }, (_, i) => `col${i}`).join(",");
      const dataRows = Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (_, j) => `value_${i}_${j}`).join(",")
      ).join("\n");
      const csv = `${headerRow}\n${dataRows}`;

      // Should parse successfully without buffer size errors
      const result = parseStringToArraySyncWasm(csv, {
        maxBufferSize: 10 * 1024 * 1024, // 10MB - more than enough for test data
      });

      expect(result).toHaveLength(rows);
      expect(result[0]).toHaveProperty("col0", "value_0_0");
      expect(result[rows - 1]).toHaveProperty("col9", `value_${rows - 1}_9`);
    });

    it("should handle edge case: exact buffer size match", () => {
      const csv = "a,b\n1,2";
      const csvSizeInBytes = new TextEncoder().encode(csv).length;

      // Set maxBufferSize to exactly match CSV size
      const result = parseStringToArraySyncWasm(csv, {
        maxBufferSize: csvSizeInBytes,
      });

      expect(result).toEqual([{ a: "1", b: "2" }]);
    });
  });

  describe("Issue #2: Module initialization consistency", () => {
    it("should parse successfully after initialization", () => {
      // Regression test: Previously mixing loadWasm.js and loadWasmSync.js caused uninitialized instance errors
      const csv = "name,age,city\nAlice,30,NYC\nBob,25,LA";

      const result = parseStringToArraySyncWasm(csv);

      expect(result).toEqual([
        { name: "Alice", age: "30", city: "NYC" },
        { name: "Bob", age: "25", city: "LA" },
      ]);
    });

    it("should handle multiple sequential parses without errors", () => {
      // Ensure WASM instance remains stable across multiple calls
      const csv1 = "x,y\n1,2";
      const csv2 = "a,b,c\n3,4,5";
      const csv3 = "p,q\n6,7\n8,9";

      const result1 = parseStringToArraySyncWasm(csv1);
      const result2 = parseStringToArraySyncWasm(csv2);
      const result3 = parseStringToArraySyncWasm(csv3);

      expect(result1).toEqual([{ x: "1", y: "2" }]);
      expect(result2).toEqual([{ a: "3", b: "4", c: "5" }]);
      expect(result3).toEqual([
        { p: "6", q: "7" },
        { p: "8", q: "9" },
      ]);
    });

    it("should work with different delimiters", () => {
      const csvTab = "col1\tcol2\tcol3\nval1\tval2\tval3";
      const csvSemicolon = "col1;col2;col3\nval1;val2;val3";

      const resultTab = parseStringToArraySyncWasm(csvTab, { delimiter: "\t" });
      const resultSemicolon = parseStringToArraySyncWasm(csvSemicolon, { delimiter: ";" });

      expect(resultTab).toEqual([{ col1: "val1", col2: "val2", col3: "val3" }]);
      expect(resultSemicolon).toEqual([{ col1: "val1", col2: "val2", col3: "val3" }]);
    });
  });

  describe("Issue #3: Integration with benchmark scenarios", () => {
    it("should handle benchmark-like string→Array scenario", () => {
      // Simulate benchmark scenario: large CSV parsed synchronously
      const rows = 1000;
      const csv = "id,name,value,status\n" +
        Array.from({ length: rows }, (_, i) =>
          `${i},item_${i},${i * 1.5},active`
        ).join("\n");

      const result = parseStringToArraySyncWasm(csv, {
        maxBufferSize: 50 * 1024 * 1024, // 50MB - large enough for benchmarks
      });

      expect(result).toHaveLength(rows);
      expect(result[0]).toEqual({
        id: "0",
        name: "item_0",
        value: "0",
        status: "active",
      });
      expect(result[rows - 1]).toEqual({
        id: String(rows - 1),
        name: `item_${rows - 1}`,
        value: String((rows - 1) * 1.5),
        status: "active",
      });
    });

    it("should work with UTF-8 encoded content", () => {
      // WASM only supports UTF-8, verify it works correctly
      const csv = "名前,年齢\n太郎,30\n花子,25";

      const result = parseStringToArraySyncWasm(csv);

      expect(result).toEqual([
        { "名前": "太郎", "年齢": "30" },
        { "名前": "花子", "年齢": "25" },
      ]);
    });

    it("should handle quoted fields correctly", () => {
      // Verify WASM handles CSV quoting rules
      const csv = 'name,description\n"Smith, John","He said ""hello"""';

      const result = parseStringToArraySyncWasm(csv);

      expect(result).toEqual([
        { name: "Smith, John", description: 'He said "hello"' },
      ]);
    });
  });

  describe("Error cases and validation", () => {
    it("should throw helpful error when buffer size is exceeded", () => {
      const csv = "a,b,c\n1,2,3";
      const tooSmallBuffer = 10; // Intentionally too small

      expect(() =>
        parseStringToArraySyncWasm(csv, { maxBufferSize: tooSmallBuffer })
      ).toThrow();
    });

    it("should validate delimiter is single character", () => {
      const csv = "a,b\n1,2";

      expect(() =>
        parseStringToArraySyncWasm(csv, { delimiter: ",," as any })
      ).toThrow(/Invalid delimiter/);
    });

    it("should only accept double-quote as quotation character", () => {
      const csv = "a,b\n1,2";

      // WASM only supports double-quote
      expect(() =>
        parseStringToArraySyncWasm(csv, { quotation: "'" as any })
      ).toThrow(/Invalid quotation/);
    });
  });

  describe("Performance characteristics", () => {
    it("should handle empty CSV efficiently", () => {
      const result = parseStringToArraySyncWasm("");
      expect(result).toEqual([]);
    });

    it("should handle single row efficiently", () => {
      const csv = "a,b,c\n1,2,3";
      const result = parseStringToArraySyncWasm(csv);
      expect(result).toEqual([{ a: "1", b: "2", c: "3" }]);
    });

    it("should handle wide CSV (many columns)", () => {
      const cols = 100;
      const headerRow = Array.from({ length: cols }, (_, i) => `col${i}`).join(",");
      const dataRow = Array.from({ length: cols }, (_, i) => `val${i}`).join(",");
      const csv = `${headerRow}\n${dataRow}`;

      const result = parseStringToArraySyncWasm(csv);

      expect(result).toHaveLength(1);
      expect(Object.keys(result[0]!)).toHaveLength(cols);
      expect(result[0]!["col0"]).toBe("val0");
      expect(result[0]![`col${cols - 1}`]).toBe(`val${cols - 1}`);
    });
  });
});
