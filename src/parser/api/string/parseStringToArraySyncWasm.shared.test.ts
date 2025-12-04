import { describe, expect, it } from "vitest";
import {
  parseWithWasm,
  prepareCSVWithHeader,
  validateWasmOptions,
} from "./parseStringToArraySyncWasm.shared.ts";

describe("parseStringToArraySyncWasm.shared", () => {
  describe("validateWasmOptions", () => {
    describe("valid options", () => {
      it("should accept default options", () => {
        const result = validateWasmOptions({});

        expect(result.delimiter).toBe(",");
        expect(result.delimiterCode).toBe(44); // "," char code
        expect(result.quotation).toBe('"');
        expect(result.maxBufferSize).toBe(10485760);
        expect(result.source).toBe("");
      });

      it("should accept custom delimiter", () => {
        const result = validateWasmOptions({ delimiter: "\t" });

        expect(result.delimiter).toBe("\t");
        expect(result.delimiterCode).toBe(9); // "\t" char code
      });

      it("should accept custom maxBufferSize", () => {
        const result = validateWasmOptions({ maxBufferSize: 1024 });

        expect(result.maxBufferSize).toBe(1024);
      });

      it("should accept source parameter", () => {
        const result = validateWasmOptions({ source: "test.csv" });

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
          const result = validateWasmOptions({ delimiter: char as any });
          expect(result.delimiterCode).toBe(code);
        }
      });
    });

    describe("invalid delimiter", () => {
      it("should reject multi-character delimiter", () => {
        expect(() => validateWasmOptions({ delimiter: ",," as any })).toThrow(
          RangeError,
        );
        expect(() => validateWasmOptions({ delimiter: ",," as any })).toThrow(
          "Invalid delimiter, must be a single character on Wasm",
        );
      });

      it("should reject empty string delimiter", () => {
        expect(() => validateWasmOptions({ delimiter: "" as any })).toThrow(
          RangeError,
        );
      });

      it("should reject non-string delimiter", () => {
        expect(() => validateWasmOptions({ delimiter: 123 as any })).toThrow();
      });
    });

    describe("invalid quotation", () => {
      it("should reject non-double-quote quotation", () => {
        expect(() => validateWasmOptions({ quotation: "'" as any })).toThrow(
          RangeError,
        );
        expect(() => validateWasmOptions({ quotation: "'" as any })).toThrow(
          "Invalid quotation, must be double quote on Wasm",
        );
      });

      it("should only accept double quote", () => {
        // Should not throw
        expect(() => validateWasmOptions({ quotation: '"' })).not.toThrow();
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

  describe("parseWithWasm", () => {
    it("should parse Wasm output as JSON", () => {
      const mockWasmFunction = () => '[{"a":"1","b":"2"}]';
      const result = parseWithWasm(
        "a,b\n1,2",
        44,
        10485760,
        1000,
        "",
        mockWasmFunction,
      );

      expect(result).toEqual([{ a: "1", b: "2" }]);
    });

    it("should pass all parameters to Wasm function", () => {
      let capturedParams: any[] = [];
      const mockWasmFunction = (...args: any[]) => {
        capturedParams = args;
        return "[]";
      };

      parseWithWasm("test csv", 59, 2048, 1000, "test.csv", mockWasmFunction);

      expect(capturedParams).toEqual(["test csv", 59, 2048, "test.csv"]);
    });

    it("should handle empty result", () => {
      const mockWasmFunction = () => "[]";
      const result = parseWithWasm("", 44, 10485760, 1000, "", mockWasmFunction);

      expect(result).toEqual([]);
    });

    it("should handle complex nested data", () => {
      const mockWasmFunction = () =>
        '[{"name":"Alice","address":{"city":"NYC"}}]';
      const result = parseWithWasm("", 44, 10485760, 1000, "", mockWasmFunction);

      expect(result).toEqual([{ name: "Alice", address: { city: "NYC" } }]);
    });

    it("should propagate JSON parse errors", () => {
      const mockWasmFunction = () => "invalid json";

      expect(() =>
        parseWithWasm("", 44, 10485760, 1000, "", mockWasmFunction),
      ).toThrow(SyntaxError);
    });
  });

  describe("integration", () => {
    it("should work together for full workflow", () => {
      // Validate options
      const options = validateWasmOptions({
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

      // Parse with Wasm
      const mockWasmFunction = (input: string) => {
        // Simulate Wasm parsing
        const lines = input.split("\n");
        const headers = lines[0]!.split(",");
        const values = lines[1]!.split(",");
        const record = Object.fromEntries(
          headers.map((h, i) => [h, values[i]]),
        );
        return JSON.stringify([record]);
      };

      const result = parseWithWasm(
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
