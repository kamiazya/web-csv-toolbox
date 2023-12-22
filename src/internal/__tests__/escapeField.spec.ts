import { describe, expect, test } from "vitest";
import { escapeField } from "../escapeField";

describe("escapeField function", () => {
  test("should escape quotation", () => {
    expect(escapeField("aa")).toBe("aa");
    expect(escapeField('"')).toBe('""""');
    expect(escapeField("a\na")).toBe('"a\na"');
    expect(escapeField("a\na")).toBe('"a\na"');
    expect(escapeField("c21", { quotation: "c" })).toBe("ccc21c");
    expect(escapeField("$", { quotation: "$" })).toBe("$$$$");
  });
});
