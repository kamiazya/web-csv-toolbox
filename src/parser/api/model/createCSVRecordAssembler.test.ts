import { describe, expect, test } from "vitest";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { createCSVRecordAssembler } from "./createCSVRecordAssembler.ts";

describe("createCSVRecordAssembler", () => {
  // Helper function to create tokens from CSV string using lexer
  function createTokens(csv: string) {
    const lexer = new FlexibleStringCSVLexer();
    return lexer.lex(csv);
  }

  describe("Basic functionality", () => {
    test("should create object assembler by default", () => {
      const assembler = createCSVRecordAssembler({
        header: ["name", "age"] as const,
      });
      const results = [...assembler.assemble(createTokens("Alice,30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should create array assembler when outputFormat is array", () => {
      const assembler = createCSVRecordAssembler({
        header: ["name", "age"] as const,
        outputFormat: "array",
      });
      const results = [...assembler.assemble(createTokens("Alice,30\n"))];
      expect(results).toEqual([["Alice", "30"]]);
    });
  });

  describe("Engine option (future extensibility)", () => {
    test("should accept engine option with wasm: true for object assembler", () => {
      // Engine option is accepted but currently ignored (no WASM assembler)
      const assembler = createCSVRecordAssembler({
        header: ["name", "age"] as const,
        engine: { wasm: true },
      });
      const results = [...assembler.assemble(createTokens("Alice,30\n"))];
      expect(results).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should accept engine option with wasm: true for array assembler", () => {
      const assembler = createCSVRecordAssembler({
        header: ["name", "age"] as const,
        outputFormat: "array",
        engine: { wasm: true },
      });
      const results = [...assembler.assemble(createTokens("Alice,30\n"))];
      expect(results).toEqual([["Alice", "30"]]);
    });

    test("should accept engine option with wasm: false", () => {
      const assembler = createCSVRecordAssembler({
        header: ["name", "age"] as const,
        engine: { wasm: false },
      });
      expect(assembler).toBeDefined();
    });
  });

  describe("Validation", () => {
    test("should throw for headerless mode with object format", () => {
      expect(() =>
        createCSVRecordAssembler({
          header: [] as const,
          outputFormat: "object",
        } as any),
      ).toThrow(/headerless/i);
    });

    test("should allow headerless mode with array format", () => {
      const assembler = createCSVRecordAssembler({
        header: [] as const,
        outputFormat: "array",
      });
      expect(assembler).toBeDefined();
    });

    test("should throw for headerless mode with non-keep columnCountStrategy", () => {
      expect(() =>
        createCSVRecordAssembler({
          header: [] as const,
          outputFormat: "array",
          columnCountStrategy: "pad",
        } as any),
      ).toThrow(/keep/i);
    });

    test("should throw for includeHeader with object format", () => {
      expect(() =>
        createCSVRecordAssembler({
          header: ["name", "age"] as const,
          outputFormat: "object",
          includeHeader: true,
        } as any),
      ).toThrow(/includeHeader/i);
    });

    test("should allow includeHeader with array format", () => {
      const assembler = createCSVRecordAssembler({
        header: ["name", "age"] as const,
        outputFormat: "array",
        includeHeader: true,
      });
      expect(assembler).toBeDefined();
    });
  });
});
