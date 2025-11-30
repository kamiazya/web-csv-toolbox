import { beforeAll, describe, expect, test } from "vitest";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { createBinaryCSVParser } from "./createBinaryCSVParser.ts";

describe("createBinaryCSVParser", () => {
  const encoder = new TextEncoder();

  describe("JavaScript implementation (default)", () => {
    test("should create object parser by default", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
      });
      const results = [...parser.parse(encoder.encode("Alice,30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should create array parser when outputFormat is array", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
      });
      const results = [...parser.parse(encoder.encode("Alice,30\n"))];
      expect(results).toEqual([["Alice", "30"]]);
    });

    test("should use JS parser when engine is undefined", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
      });
      const results = [...parser.parse(encoder.encode("Alice,30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should use JS parser when engine.wasm is false", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        engine: { wasm: false },
      });
      const results = [...parser.parse(encoder.encode("Alice,30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should support custom delimiter with JS parser", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        delimiter: "\t",
      } as any);
      const results = [...parser.parse(encoder.encode("Alice\t30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should support non-UTF-8 charset with JS parser", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const results = [...parser.parse(encoder.encode("Alice,30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });
  });

  describe("WASM implementation", () => {
    beforeAll(async () => {
      await loadWASM();
    });

    test("should create WASM object parser when engine.wasm is true", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        engine: { wasm: true },
      });
      const results = [...parser.parse(encoder.encode("Alice,30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should create WASM array parser when engine.wasm is true and outputFormat is array", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
        engine: { wasm: true },
      });
      const results = [...parser.parse(encoder.encode("Alice,30\n"))];
      expect(results).toEqual([["Alice", "30"]]);
    });

    test("should support custom single-char delimiter with WASM parser", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        delimiter: "\t",
        engine: { wasm: true },
      } as any);
      const results = [...parser.parse(encoder.encode("Alice\t30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should support custom single-char quotation with WASM parser", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        quotation: "'",
        engine: { wasm: true },
      } as any);
      const results = [...parser.parse(encoder.encode("'Alice',30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });
  });

  describe("Validation", () => {
    test("should throw for includeHeader with object format", () => {
      expect(() =>
        createBinaryCSVParser({
          header: ["name", "age"] as const,
          outputFormat: "object",
          includeHeader: true,
        } as any),
      ).toThrow(/includeHeader/i);
    });

    test("should allow includeHeader with array format", () => {
      const parser = createBinaryCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
        includeHeader: true,
      });
      expect(parser).toBeDefined();
    });
  });
});
