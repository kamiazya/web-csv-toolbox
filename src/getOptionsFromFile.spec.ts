import { describe, expect, it } from "vitest";
import { getOptionsFromFile } from "./getOptionsFromFile.ts";

describe("getOptionsFromFile", () => {
  it("should extract charset from File type", () => {
    const file = new File(["name,age\nAlice,42"], "test.csv", {
      type: "text/csv; charset=utf-8",
    });

    const options = getOptionsFromFile(file);

    expect(options.charset).toBe("utf-8");
  });

  it("should automatically set source to file.name", () => {
    const file = new File(["name,age\nAlice,42"], "users.csv", {
      type: "text/csv",
    });

    const options = getOptionsFromFile(file);

    expect(options.source).toBe("users.csv");
  });

  it("should extract both charset and source", () => {
    const file = new File(["name,age\nAlice,42"], "data.csv", {
      type: "text/csv; charset=shift-jis",
    });

    const options = getOptionsFromFile(file);

    expect(options.charset).toBe("shift-jis");
    expect(options.source).toBe("data.csv");
  });

  it("should respect user-provided source option", () => {
    const file = new File(["name,age\nAlice,42"], "test.csv", {
      type: "text/csv",
    });

    const options = getOptionsFromFile(file, {
      source: "custom-source.csv",
    });

    expect(options.source).toBe("custom-source.csv");
  });

  it("should merge user options with extracted options", () => {
    const file = new File(["name,age\nAlice,42"], "data.csv", {
      type: "text/csv; charset=utf-8",
    });

    const options = getOptionsFromFile(file, {
      delimiter: "\t",
      quotation: "'",
    });

    expect(options.charset).toBe("utf-8");
    expect(options.source).toBe("data.csv");
    expect(options.delimiter).toBe("\t");
    expect(options.quotation).toBe("'");
  });

  it("should not override user-provided charset", () => {
    const file = new File(["name,age\nAlice,42"], "test.csv", {
      type: "text/csv; charset=utf-8",
    });

    const options = getOptionsFromFile(file, {
      charset: "shift-jis",
    });

    // User-provided charset should take precedence
    expect(options.charset).toBe("shift-jis");
  });

  it("should handle File without explicit charset", () => {
    const file = new File(["name,age\nAlice,42"], "data.csv", {
      type: "text/csv",
    });

    const options = getOptionsFromFile(file);

    expect(options.charset).toBeUndefined();
    expect(options.source).toBe("data.csv");
  });

  it("should handle File with empty filename", () => {
    const file = new File(["name,age\nAlice,42"], "", {
      type: "text/csv",
    });

    const options = getOptionsFromFile(file);

    expect(options.source).toBe("");
  });

  it("should handle File with special characters in filename", () => {
    const file = new File(["name,age\nAlice,42"], "データ (2024).csv", {
      type: "text/csv",
    });

    const options = getOptionsFromFile(file);

    expect(options.source).toBe("データ (2024).csv");
  });
});
