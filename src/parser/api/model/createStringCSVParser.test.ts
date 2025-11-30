import { beforeAll, describe, expect, test } from "vitest";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { createStringCSVParser } from "./createStringCSVParser.ts";

describe("createStringCSVParser", () => {
  describe("JavaScript implementation (default)", () => {
    test("should create object parser by default", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
      });
      const results = [...parser.parse("Alice,30\n")];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should create array parser when outputFormat is array", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
      });
      const results = [...parser.parse("Alice,30\n")];
      expect(results).toEqual([["Alice", "30"]]);
    });

    test("should use JS parser when engine is undefined", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
      });
      const results = [...parser.parse("Alice,30\n")];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should use JS parser when engine.wasm is false", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        engine: { wasm: false },
      });
      const results = [...parser.parse("Alice,30\n")];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should support custom delimiter with JS parser", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        delimiter: "\t",
      } as any);
      const results = [...parser.parse("Alice\t30\n")];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should support custom quotation with JS parser", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        quotation: "'",
      } as any);
      const results = [...parser.parse("'Alice',30\n")];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });
  });

  describe("WASM implementation", () => {
    beforeAll(async () => {
      await loadWASM();
    });

    test("should create WASM object parser when engine.wasm is true", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        engine: { wasm: true },
      });
      const results = [...parser.parse("Alice,30\n")];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should create WASM array parser when engine.wasm is true and outputFormat is array", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
        engine: { wasm: true },
      });
      const results = [...parser.parse("Alice,30\n")];
      expect(results).toEqual([["Alice", "30"]]);
    });

    test("should support custom single-char delimiter with WASM parser", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        delimiter: "\t",
        engine: { wasm: true },
      } as any);
      const results = [...parser.parse("Alice\t30\n")];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should support custom single-char quotation with WASM parser", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        quotation: "'",
        engine: { wasm: true },
      } as any);
      const results = [...parser.parse("'Alice',30\n")];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });
  });

  describe("Validation", () => {
    test("should throw for includeHeader with object format", () => {
      expect(() =>
        createStringCSVParser({
          header: ["name", "age"] as const,
          outputFormat: "object",
          includeHeader: true,
        } as any),
      ).toThrow(/includeHeader/i);
    });

    test("should allow includeHeader with array format", () => {
      const parser = createStringCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
        includeHeader: true,
      });
      expect(parser).toBeDefined();
    });
  });
});
