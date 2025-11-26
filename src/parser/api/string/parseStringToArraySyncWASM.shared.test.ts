import type { FlatParseResult } from "web-csv-toolbox-wasm";
import { describe, expect, it } from "vitest";
import {
  parseWithWASM,
  prepareCSVWithHeader,
  validateWASMOptions,
} from "./parseStringToArraySyncWASM.shared.ts";

// Helper to create mock FlatParseResult for testing
function createMockFlatResult(
  headers: string[] | null,
  fieldData: string[],
  actualFieldCounts: number[],
  recordCount: number,
  fieldCount: number,
): FlatParseResult {
  return {
    headers,
    fieldData,
    actualFieldCounts,
    recordCount,
    fieldCount,
    free: () => {},
    [Symbol.dispose]: () => {},
  } as FlatParseResult;
}

describe("parseStringToArraySyncWASM.shared", () => {
  describe("validateWASMOptions", () => {
    describe("valid options", () => {
      it("should accept default options", () => {
        const result = validateWASMOptions({});

        expect(result.delimiter).toBe(",");
        expect(result.delimiterCode).toBe(44); // "," char code
        expect(result.quotation).toBe('"');
        expect(result.maxBufferSize).toBe(10485760);
        expect(result.maxFieldCount).toBe(100000);
        expect(result.source).toBe("");
      });

      it("should accept custom delimiter", () => {
        const result = validateWASMOptions({ delimiter: "\t" });

        expect(result.delimiter).toBe("\t");
        expect(result.delimiterCode).toBe(9); // "\t" char code
      });

      it("should accept custom maxBufferSize", () => {
        const result = validateWASMOptions({ maxBufferSize: 1024 });

        expect(result.maxBufferSize).toBe(1024);
      });

      it("should accept custom maxFieldCount", () => {
        const result = validateWASMOptions({ maxFieldCount: 50000 });

        expect(result.maxFieldCount).toBe(50000);
      });

      it("should accept source parameter", () => {
        const result = validateWASMOptions({ source: "test.csv" });

        expect(result.source).toBe("test.csv");
      });

      it("should calculate delimiter character code correctly", () => {
        const delimiters = [
          { char: ",", code: 44 },
          { char: "\t", code: 9 },
          { char: ";", code: 59 },
          { char: "|", code: 124 },
        ];

        for (const { char, code } of delimiters) {
          const result = validateWASMOptions({ delimiter: char as any });
          expect(result.delimiterCode).toBe(code);
        }
      });
    });

    describe("invalid delimiter", () => {
      it("should reject multi-character delimiter", () => {
        expect(() => validateWASMOptions({ delimiter: ",," as any })).toThrow(
          RangeError,
        );
        expect(() => validateWASMOptions({ delimiter: ",," as any })).toThrow(
          "Invalid delimiter, must be a single character on WASM",
        );
      });

      it("should reject empty string delimiter", () => {
        expect(() => validateWASMOptions({ delimiter: "" as any })).toThrow(
          RangeError,
        );
      });

      it("should reject non-string delimiter", () => {
        expect(() => validateWASMOptions({ delimiter: 123 as any })).toThrow();
      });
    });

    describe("invalid quotation", () => {
      it("should reject non-double-quote quotation", () => {
        expect(() => validateWASMOptions({ quotation: "'" as any })).toThrow(
          RangeError,
        );
        expect(() => validateWASMOptions({ quotation: "'" as any })).toThrow(
          "Invalid quotation, must be double quote on WASM",
        );
      });

      it("should only accept double quote", () => {
        // Should not throw
        expect(() => validateWASMOptions({ quotation: '"' })).not.toThrow();
      });
    });

    describe("invalid maxFieldCount", () => {
      it("should reject zero maxFieldCount", () => {
        expect(() => validateWASMOptions({ maxFieldCount: 0 })).toThrow(
          RangeError,
        );
        expect(() => validateWASMOptions({ maxFieldCount: 0 })).toThrow(
          "maxFieldCount must be a positive integer",
        );
      });

      it("should reject negative maxFieldCount", () => {
        expect(() => validateWASMOptions({ maxFieldCount: -1 })).toThrow(
          RangeError,
        );
      });

      it("should reject non-integer maxFieldCount", () => {
        expect(() => validateWASMOptions({ maxFieldCount: 1.5 })).toThrow(
          RangeError,
        );
      });

      it("should reject non-number maxFieldCount", () => {
        expect(() =>
          validateWASMOptions({ maxFieldCount: "100" as any }),
        ).toThrow(RangeError);
      });
    });
  });

  describe("prepareCSVWithHeader", () => {
    describe("without custom header", () => {
      it("should return original CSV when header is undefined", () => {
        const csv = "a,b,c\n1,2,3";
        const result = prepareCSVWithHeader(csv, undefined, ",", '"');

        expect(result).toBe(csv);
      });

      it("should return original CSV when header is not provided", () => {
        const csv = "x,y,z\n10,20,30";
        const result = prepareCSVWithHeader(csv, undefined, ",", '"');

        expect(result).toBe(csv);
      });
    });

    describe("with custom header", () => {
      it("should prepend simple header", () => {
        const csv = "1,2,3";
        const header = ["a", "b", "c"];
        const result = prepareCSVWithHeader(csv, header, ",", '"');

        expect(result).toBe("a,b,c\n1,2,3");
      });

      it("should escape fields containing delimiter", () => {
        const csv = "1,2,3";
        const header = ["a,x", "b", "c"];
        const result = prepareCSVWithHeader(csv, header, ",", '"');

        expect(result).toBe('"a,x",b,c\n1,2,3');
      });

      it("should escape fields containing quotation", () => {
        const csv = "1,2,3";
        const header = ['a"b', "c", "d"];
        const result = prepareCSVWithHeader(csv, header, ",", '"');

        expect(result).toBe('"a""b",c,d\n1,2,3');
      });

      it("should escape fields containing newline", () => {
        const csv = "1,2,3";
        const header = ["a\nb", "c", "d"];
        const result = prepareCSVWithHeader(csv, header, ",", '"');

        expect(result).toBe('"a\nb",c,d\n1,2,3');
      });

      it("should escape fields containing carriage return", () => {
        const csv = "1,2,3";
        const header = ["a\rb", "c", "d"];
        const result = prepareCSVWithHeader(csv, header, ",", '"');

        expect(result).toBe('"a\rb",c,d\n1,2,3');
      });

      it("should handle multiple fields needing escaping", () => {
        const csv = "1,2,3";
        const header = ["a,b", 'c"d', "e\nf"];
        const result = prepareCSVWithHeader(csv, header, ",", '"');

        expect(result).toBe('"a,b","c""d","e\nf"\n1,2,3');
      });

      it("should work with custom delimiter", () => {
        const csv = "1\t2\t3";
        const header = ["a", "b\tc", "d"];
        const result = prepareCSVWithHeader(csv, header, "\t", '"');

        expect(result).toBe('a\t"b\tc"\td\n1\t2\t3');
      });

      it("should double-escape multiple quotes", () => {
        const csv = "1,2,3";
        const header = ['a""b', "c", "d"];
        const result = prepareCSVWithHeader(csv, header, ",", '"');

        expect(result).toBe('"a""""b",c,d\n1,2,3');
      });
    });
  });

  describe("parseWithWASM", () => {
    it("should convert FlatParseResult to object array", () => {
      const mockWasmFunction = () =>
        createMockFlatResult(["a", "b"], ["1", "2"], [2], 1, 2);
      const result = parseWithWASM(
        "a,b\n1,2",
        44,
        10485760,
        100000,
        "",
        mockWasmFunction,
      );

      expect(result).toEqual([{ a: "1", b: "2" }]);
    });

    it("should pass all parameters to WASM function", () => {
      let capturedParams: any[] = [];
      const mockWasmFunction = (...args: any[]) => {
        capturedParams = args;
        return createMockFlatResult(null, [], [], 0, 0);
      };

      parseWithWASM("test csv", 59, 2048, 50000, "test.csv", mockWasmFunction);

      expect(capturedParams).toEqual([
        "test csv",
        59,
        2048,
        50000,
        "test.csv",
      ]);
    });

    it("should handle empty result", () => {
      const mockWasmFunction = () =>
        createMockFlatResult(null, [], [], 0, 0);
      const result = parseWithWASM(
        "",
        44,
        10485760,
        100000,
        "",
        mockWasmFunction,
      );

      expect(result).toEqual([]);
    });

    it("should handle sparse records with actualFieldCounts", () => {
      // Second record has only 2 fields, third field should be undefined
      const mockWasmFunction = () =>
        createMockFlatResult(
          ["a", "b", "c"],
          ["1", "2", "3", "4", "5", ""],
          [3, 2],
          2,
          3,
        );
      const result = parseWithWASM(
        "",
        44,
        10485760,
        100000,
        "",
        mockWasmFunction,
      );

      expect(result).toEqual([
        { a: "1", b: "2", c: "3" },
        { a: "4", b: "5", c: undefined },
      ]);
    });

    it("should propagate errors from WASM function", () => {
      const mockWasmFunction = () => {
        throw new Error("WASM parsing failed");
      };

      expect(() =>
        parseWithWASM("", 44, 10485760, 100000, "", mockWasmFunction),
      ).toThrow("WASM parsing failed");
    });
  });

  describe("integration", () => {
    it("should work together for full workflow", () => {
      // Validate options
      const options = validateWASMOptions({
        delimiter: ",",
        quotation: '"',
        maxBufferSize: 1024,
        source: "test.csv",
      });

      // Prepare CSV with header
      const csv = "1,2,3";
      const header = ["a", "b", "c"];
      const csvToParse = prepareCSVWithHeader(
        csv,
        header,
        options.delimiter,
        options.quotation,
      );

      expect(csvToParse).toBe("a,b,c\n1,2,3");

      // Parse with WASM - returns FlatParseResult
      const mockWasmFunction = (_input: string) => {
        return createMockFlatResult(
          ["a", "b", "c"],
          ["1", "2", "3"],
          [3],
          1,
          3,
        );
      };

      const result = parseWithWASM(
        csvToParse,
        options.delimiterCode,
        options.maxBufferSize,
        options.maxFieldCount,
        options.source,
        mockWasmFunction,
      );

      expect(result).toEqual([{ a: "1", b: "2", c: "3" }]);
    });
  });
});
