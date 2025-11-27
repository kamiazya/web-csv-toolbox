import { describe, expect, test } from "vitest";
import { createStringCSVLexer } from "./createStringCSVLexer.ts";

describe("createStringCSVLexer", () => {
  describe("Basic functionality", () => {
    test("should create lexer with default options", () => {
      const lexer = createStringCSVLexer();
      const tokens = [...lexer.lex("a,b\n")];
      expect(tokens.length).toBeGreaterThan(0);
    });

    test("should create lexer with custom delimiter", () => {
      const lexer = createStringCSVLexer({
        delimiter: "\t",
      });
      const tokens = [...lexer.lex("a\tb\n")];
      expect(tokens.length).toBeGreaterThan(0);
    });

    test("should create lexer with custom quotation", () => {
      const lexer = createStringCSVLexer({
        quotation: "'",
      });
      const tokens = [...lexer.lex("'a',b\n")];
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe("Engine option (future extensibility)", () => {
    test("should accept engine option with wasm: true", () => {
      // Engine option is accepted but currently ignored (no WASM lexer)
      const lexer = createStringCSVLexer({
        engine: { wasm: true },
      });
      const tokens = [...lexer.lex("a,b\n")];
      expect(tokens.length).toBeGreaterThan(0);
    });

    test("should accept engine option with wasm: false", () => {
      const lexer = createStringCSVLexer({
        engine: { wasm: false },
      });
      const tokens = [...lexer.lex("a,b\n")];
      expect(tokens.length).toBeGreaterThan(0);
    });

    test("should work with custom delimiter and engine option", () => {
      const lexer = createStringCSVLexer({
        delimiter: "\t",
        engine: { wasm: true },
      });
      const tokens = [...lexer.lex("a\tb\n")];
      expect(tokens.length).toBeGreaterThan(0);
    });

    test("should work with custom quotation and engine option", () => {
      const lexer = createStringCSVLexer({
        quotation: "'",
        engine: { wasm: true },
      });
      const tokens = [...lexer.lex("'a',b\n")];
      expect(tokens.length).toBeGreaterThan(0);
    });
  });
});
