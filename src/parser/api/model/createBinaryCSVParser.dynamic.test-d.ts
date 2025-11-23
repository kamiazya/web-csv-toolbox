import { describe, test } from "vitest";
import type { CSVArrayRecord, CSVObjectRecord } from "@/core/types.ts";
import { createBinaryCSVParser } from "./createBinaryCSVParser.ts";

describe("createBinaryCSVParser with dynamic outputFormat", () => {
  test("should infer union type when outputFormat is dynamic", () => {
    const format: "object" | "array" = "object" as "object" | "array";
    const parser = createBinaryCSVParser({
      header: ["name", "age"] as const,
      outputFormat: format,
      charset: "utf-8",
    });

    const encoder = new TextEncoder();
    const data = encoder.encode("Alice,30\n");
    const result = parser.parse(data);

    for (const record of result) {
      // This compiles successfully if union type is correctly inferred
      const _test:
        | CSVObjectRecord<readonly ["name", "age"]>
        | CSVArrayRecord<readonly ["name", "age"]> = record;
      void _test;
      break;
    }
  });

  test("should infer object parser when outputFormat is 'object' literal", () => {
    const parser = createBinaryCSVParser({
      header: ["name", "age"] as const,
      outputFormat: "object",
      charset: "utf-8",
    });

    const encoder = new TextEncoder();
    const data = encoder.encode("Alice,30\n");
    const result = parser.parse(data);

    for (const record of result) {
      // This compiles successfully if object type is correctly inferred
      const name: string = record.name;
      const age: string = record.age;
      void name;
      void age;
      break;
    }
  });

  test("should infer array parser when outputFormat is 'array' literal", () => {
    const parser = createBinaryCSVParser({
      header: ["name", "age"] as const,
      outputFormat: "array",
      charset: "utf-8",
    });

    const encoder = new TextEncoder();
    const data = encoder.encode("Alice,30\n");
    const result = parser.parse(data);

    for (const record of result) {
      // This compiles successfully if array type is correctly inferred
      const first: string = record[0];
      const second: string = record[1];
      void first;
      void second;
      break;
    }
  });

  test("should infer object parser when outputFormat is omitted", () => {
    const parser = createBinaryCSVParser({
      header: ["name", "age"] as const,
      charset: "utf-8",
    });

    const encoder = new TextEncoder();
    const data = encoder.encode("Alice,30\n");
    const result = parser.parse(data);

    for (const record of result) {
      // Default should be object type
      const name: string = record.name;
      const age: string = record.age;
      void name;
      void age;
      break;
    }
  });

  test("should work with runtime format switching", () => {
    function getFormat(): "object" | "array" {
      return Math.random() > 0.5 ? "object" : "array";
    }

    const format = getFormat();
    const parser = createBinaryCSVParser({
      header: ["name", "age"] as const,
      outputFormat: format,
      charset: "utf-8",
    });

    const encoder = new TextEncoder();
    const data = encoder.encode("Alice,30\n");
    const result = parser.parse(data);

    for (const record of result) {
      // Union type allows both usages
      if ("name" in record) {
        const name: string = record.name;
        void name;
      } else {
        const first: string = record[0];
        void first;
      }
      break;
    }
  });
});
