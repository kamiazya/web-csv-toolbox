import { describe, expect, it } from "vitest";
import { CSVLexer } from "./CSVLexer.ts";
import { ParseError } from "./common/errors.ts";

/**
 * Tests for undefined checks added for TypeScript 5.9 strict type checking
 */
describe("CSVLexer undefined checks", () => {
  it("should handle empty buffer during quoted field parsing with flush", () => {
    const lexer = new CSVLexer();

    // Start a quoted field but don't complete it
    // This should trigger the undefined check when flush is called
    expect(() => {
      const gen = lexer.lex('"incomplete');
      Array.from(gen);
    }).toThrow(ParseError);
  });

  it("should parse complete quoted field correctly", () => {
    const lexer = new CSVLexer();

    // Process a complete quoted field
    const gen = lexer.lex('"field"');
    const tokens = Array.from(gen);

    // Should successfully parse the complete field
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.value).toBe("field");
  });

  it("should parse a single unquoted field", () => {
    const lexer = new CSVLexer();

    // Normal field parsing should work correctly
    const gen = lexer.lex("field");
    const tokens = Array.from(gen);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.value).toBe("field");
  });
});
