import { describe, expect, it } from "vitest";
import { parseMime } from "./parseMime.ts";

describe("parseMime security tests", () => {
  it("should handle missing parameter values without throwing", () => {
    // Test case for the vulnerability: parameter without value should not crash
    expect(() => parseMime("text/csv; charset")).not.toThrow();
    const result = parseMime("text/csv; charset");
    expect(result.type).toBe("text/csv");
    // Parameter without value should be ignored
    expect(result.parameters.charset).toBeUndefined();
  });

  it("should handle multiple parameters with missing values", () => {
    expect(() =>
      parseMime("text/csv; charset; delimiter; header=present"),
    ).not.toThrow();
    const result = parseMime("text/csv; charset; delimiter; header=present");
    expect(result.type).toBe("text/csv");
    expect(result.parameters.charset).toBeUndefined();
    expect(result.parameters.delimiter).toBeUndefined();
    expect(result.parameters.header).toBe("present");
  });

  it("should handle malformed Content-Type with only semicolons", () => {
    expect(() => parseMime("text/csv;;;")).not.toThrow();
    const result = parseMime("text/csv;;;");
    expect(result.type).toBe("text/csv");
    expect(Object.keys(result.parameters)).toHaveLength(0);
  });

  it("should handle empty parameter values", () => {
    const result = parseMime("text/csv; charset=");
    expect(result.type).toBe("text/csv");
    expect(result.parameters.charset).toBe("");
  });

  it("should handle parameters with special characters in values", () => {
    // These should be parsed but validation happens elsewhere
    const testCases = [
      "text/csv; charset=<script>alert(1)</script>",
      "text/csv; charset=../../etc/passwd",
      "text/csv; charset=null",
      "text/csv; charset=undefined",
    ];

    for (const testCase of testCases) {
      expect(() => parseMime(testCase)).not.toThrow();
      const result = parseMime(testCase);
      expect(result.type).toBe("text/csv");
      expect(result.parameters.charset).toBeDefined();
    }
  });

  it("should trim whitespace from parameters", () => {
    const result = parseMime(
      "text/csv;  charset = utf-8  ;  header = present ",
    );
    expect(result.parameters.charset).toBe("utf-8");
    expect(result.parameters.header).toBe("present");
  });

  it("should handle parameter keys without trimming issues", () => {
    const result = parseMime("text/csv;charset=utf-8");
    expect(result.parameters.charset).toBe("utf-8");
  });
});
